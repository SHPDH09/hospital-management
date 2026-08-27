import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Check, Shield, Zap, ArrowLeft, CreditCard, Lock, Sparkles, Building2, Crown,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { StatusBadge, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';

type BillingCycle = 'MONTHLY' | 'YEARLY';
type Step = 'plans' | 'checkout';

interface PlanRow {
  id: string;
  code: string;
  name: string;
  tier?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  price?: number;
  trialDays?: number;
  features?: string[];
  sortOrder?: number;
}

interface CheckoutQuote {
  plan: { id: string; code: string; name: string; features: string[] };
  subtotal: number;
  taxRate: number;
  taxName: string;
  taxAmount: number;
  total: number;
  billingCycle: BillingCycle;
  isFree?: boolean;
  yearlySavingsPercent?: number;
  paymentConfigured?: boolean;
  cashfreeMode?: 'sandbox' | 'production';
  whitelistDomain?: string;
  whitelistDashboardUrl?: string;
  requiresDomainWhitelist?: boolean;
  domainWhitelisted?: boolean;
}

function loadCashfreeSdk() {
  return new Promise<((opts: { mode: string }) => { checkout: (o: Record<string, unknown>) => void }) | null>((resolve) => {
    const w = window as unknown as { Cashfree?: (opts: { mode: string }) => { checkout: (o: Record<string, unknown>) => void } };
    if (w.Cashfree) return resolve(w.Cashfree);
    const s = document.createElement('script');
    s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload = () => resolve(w.Cashfree ?? null);
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
}

const POPULAR_CODE = 'professional';

function planAmount(p: PlanRow, cycle: BillingCycle) {
  return cycle === 'YEARLY' ? Number(p.yearlyPrice || 0) : Number(p.monthlyPrice ?? p.price ?? 0);
}

export function CrmSubscriptionPage() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('plans');
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [selectedPlan, setSelectedPlan] = useState<PlanRow | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({ queryKey: ['crm-subscription'], queryFn: () => api.get('/crm/subscription') });
  const { data: plansData } = useQuery({ queryKey: ['crm-subscription-plans'], queryFn: () => api.get('/crm/subscription/plans') });

  const payload = data?.data as {
    subscription?: Record<string, unknown> & { payments?: Record<string, unknown>[] };
    daysRemaining?: number | null;
    access?: { isTrial?: boolean; isExpired?: boolean };
  } | undefined;

  const sub = payload?.subscription;
  const currentPlan = sub?.plan as PlanRow | undefined;
  const plans = ((plansData?.data as PlanRow[]) || []).filter((p) => p.code !== 'starter').sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const payments = (sub?.payments as Record<string, unknown>[]) ?? [];

  // Verify payment on return from Cashfree or after manual return
  useEffect(() => {
    const paymentId = searchParams.get('payment_id') || sessionStorage.getItem('pendingSubscriptionPayment');
    if (!paymentId) return;
    let attempts = 0;
    const verify = async () => {
      const res = await api.post(`/crm/subscription/verify/${paymentId}`);
      if (res.success) {
        sessionStorage.removeItem('pendingSubscriptionPayment');
        setNotice({ kind: 'success', text: 'Payment successful! Your subscription is now active.' });
        refetch();
        setStep('plans');
        return true;
      }
      return false;
    };
    verify();
    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts > 20) {
        clearInterval(timer);
        return;
      }
      const done = await verify();
      if (done) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [searchParams, refetch]);

  const choosePlan = async (plan: PlanRow) => {
    setSelectedPlan(plan);
    setNotice(null);
    const res = await api.get<CheckoutQuote>(`/crm/subscription/checkout-quote?planId=${plan.id}&billingCycle=${cycle}`);
    if (!res.success || !res.data) {
      setNotice({ kind: 'error', text: res.error || 'Could not load pricing' });
      return;
    }
    setQuote(res.data);
    setStep('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const payNow = async () => {
    if (!selectedPlan) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await api.post<CheckoutQuote & { paymentId?: string; paymentSessionId?: string; status?: string; planName?: string }>(
        '/crm/subscription/checkout',
        { planId: selectedPlan.id, billingCycle: cycle },
      );
      if (!res.success) {
        const err = res.error || 'Payment could not be started';
        setNotice({
          kind: 'error',
          text: err.toLowerCase().includes('authentication')
            ? 'Cashfree authentication failed. Platform admin must verify App ID & Secret Key under Admin → Settings → Payment Gateway (Sandbox mode must match your Cashfree keys).'
            : err,
        });
        return;
      }
      if (res.data?.status === 'COMPLETED' || res.data?.isFree) {
        setNotice({ kind: 'success', text: `${res.data.plan?.name || selectedPlan.name} plan activated!` });
        setStep('plans');
        refetch();
        return;
      }
      const sessionId = res.data?.paymentSessionId;
      const mode = res.data?.cashfreeMode === 'production' ? 'production' : 'sandbox';
      if (!sessionId) {
        setNotice({ kind: 'error', text: 'Payment session not created. Please check Cashfree configuration or try again.' });
        return;
      }
      if (res.data?.paymentId) {
        sessionStorage.setItem('pendingSubscriptionPayment', res.data.paymentId);
      }
      const cf = await loadCashfreeSdk();
      if (!cf) {
        setNotice({ kind: 'error', text: 'Payment SDK failed to load. Please refresh and try again.' });
        return;
      }
      cf({ mode }).checkout({ paymentSessionId: sessionId, redirectTarget: '_self' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout portal="crm">
      {/* Premium hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 px-6 py-10 text-white shadow-xl sm:px-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-primary-200">
              <Sparkles className="h-4 w-4" /> Subscription & Billing
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {step === 'checkout' ? 'Review & Pay' : 'Choose the right plan'}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              {step === 'checkout'
                ? 'Review your order summary with GST before completing payment.'
                : 'Trusted by hospitals and clinics across India. Scale your practice with enterprise-grade tools.'}
            </p>
          </div>
          {sub && currentPlan && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wider text-slate-400">Current plan</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <Crown className="h-5 w-5 text-amber-400" />{currentPlan.name}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={String(sub.status)} />
                {payload?.daysRemaining != null && (
                  <span className="text-xs text-slate-400">{payload.daysRemaining} days left</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-4">
        {(['plans', 'checkout'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
              step === s ? 'bg-primary-600 text-white' : i < ['plans', 'checkout'].indexOf(step) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500',
            )}>
              {i + 1}
            </div>
            <span className={cn('text-sm font-medium', step === s ? 'text-gray-900' : 'text-gray-400')}>
              {s === 'plans' ? 'Choose Plan' : 'Payment Details'}
            </span>
            {i === 0 && <div className="mx-2 h-px w-12 bg-gray-200" />}
          </div>
        ))}
      </div>

      {notice && (
        <div className={cn('mb-6 rounded-xl border p-4 text-sm',
          notice.kind === 'error' && 'border-red-200 bg-red-50 text-red-800',
          notice.kind === 'success' && 'border-green-200 bg-green-50 text-green-800',
          notice.kind === 'info' && 'border-blue-200 bg-blue-50 text-blue-800',
        )}>
          {notice.text}
        </div>
      )}

      {isLoading ? <LoadingState /> : step === 'plans' ? (
        <>
          {/* Billing toggle */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                className={cn('rounded-full px-6 py-2 text-sm font-semibold transition-all', cycle === 'MONTHLY' ? 'bg-white text-gray-900 shadow' : 'text-gray-500')}
                onClick={() => setCycle('MONTHLY')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={cn('rounded-full px-6 py-2 text-sm font-semibold transition-all', cycle === 'YEARLY' ? 'bg-white text-gray-900 shadow' : 'text-gray-500')}
                onClick={() => setCycle('YEARLY')}
              >
                Yearly <span className="ml-1 text-xs text-green-600">Save up to 17%</span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => {
              const price = planAmount(p, cycle);
              const isCurrent = currentPlan?.id === p.id;
              const isPopular = p.code === POPULAR_CODE;
              const isFree = price <= 0 && p.code === 'free';

              return (
                <div
                  key={p.id}
                  className={cn(
                    'relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-lg',
                    isPopular && 'border-primary-400 ring-2 ring-primary-100',
                    isCurrent && 'border-green-300 bg-green-50/30',
                  )}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
                      Most Popular
                    </span>
                  )}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{p.name}</h3>
                      {p.tier && <p className="text-xs uppercase tracking-wide text-gray-400">{p.tier}</p>}
                    </div>
                    {isCurrent && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Current</span>}
                  </div>

                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">{isFree ? 'Free' : formatCurrency(price)}</span>
                    {!isFree && <span className="text-gray-500">/{cycle === 'YEARLY' ? 'year' : 'mo'}</span>}
                    {Number(p.trialDays) > 0 && <p className="mt-1 text-xs text-green-600">{p.trialDays}-day free trial included</p>}
                  </div>

                  <ul className="mt-6 flex-1 space-y-3">
                    {(p.features || []).slice(0, 6).map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    disabled={isCurrent}
                    className={cn('mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-all',
                      isCurrent ? 'cursor-default bg-gray-100 text-gray-400' :
                      isPopular ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200' :
                      'border-2 border-primary-600 text-primary-600 hover:bg-primary-50',
                    )}
                    onClick={() => choosePlan(p)}
                  >
                    {isCurrent ? 'Current Plan' : isFree ? 'Get Started Free' : 'Choose Plan →'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Trust badges */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: Shield, title: 'Secure Payments', desc: '256-bit SSL · Cashfree PCI-DSS' },
              { icon: Building2, title: 'GST Compliant', desc: '18% GST invoice on every payment' },
              { icon: Zap, title: 'Instant Activation', desc: 'Plan activates immediately after payment' },
            ].map((b) => (
              <div key={b.title} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-white shadow-sm">
                  <b.icon className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{b.title}</p>
                  <p className="text-xs text-gray-500">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Checkout step */
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-5">
          {quote?.requiresDomainWhitelist && !quote?.domainWhitelisted && (
            <div className="lg:col-span-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-semibold">Live Cashfree payment</p>
              <p className="mt-1">
                You will be redirected to the official Cashfree payment page (UPI, Card, Net Banking).
                After payment, return to this Subscription page — your plan will activate automatically.
              </p>
            </div>
          )}
          <div className="lg:col-span-3">
            <button type="button" className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600" onClick={() => setStep('plans')}>
              <ArrowLeft className="h-4 w-4" /> Back to plans
            </button>

            <div className="card overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-6 py-4">
                <h2 className="font-semibold text-gray-900">Order Summary</h2>
                <p className="text-sm text-gray-500">{quote?.plan.name} · {cycle === 'YEARLY' ? 'Annual' : 'Monthly'} billing</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{quote?.plan.name} subscription</span>
                  <span className="font-medium">{formatCurrency(quote?.subtotal ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{quote?.taxName || 'GST'} ({quote?.taxRate ?? 18}%)</span>
                  <span className="font-medium">{formatCurrency(quote?.taxAmount ?? 0)}</span>
                </div>
                <div className="border-t border-gray-100 pt-4 flex justify-between">
                  <span className="font-semibold text-gray-900">Total payable</span>
                  <span className="text-2xl font-bold text-primary-600">{formatCurrency(quote?.total ?? 0)}</span>
                </div>
                <p className="text-xs text-gray-400">Inclusive of {quote?.taxName || 'GST'} as per Indian tax regulations. Invoice will be generated after payment.</p>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {(quote?.plan.features || []).map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check className="h-4 w-4 text-green-500" />{f}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <div className="card sticky top-24 p-6">
              <h3 className="font-semibold text-gray-900">Complete Payment</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Plan</span><span className="font-medium">{quote?.plan.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Billing</span><span className="font-medium">{cycle === 'YEARLY' ? 'Yearly' : 'Monthly'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(quote?.subtotal ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">GST (18%)</span><span>{formatCurrency(quote?.taxAmount ?? 0)}</span></div>
                <div className="border-t pt-3 flex justify-between font-bold text-lg">
                  <span>Total</span><span className="text-primary-600">{formatCurrency(quote?.total ?? 0)}</span>
                </div>
              </div>

              <button
                type="button"
                className="btn-primary mt-6 w-full flex items-center justify-center gap-2 py-3 text-base font-semibold"
                disabled={busy || (!quote?.paymentConfigured && !quote?.isFree)}
                onClick={payNow}
              >
                <CreditCard className="h-5 w-5" />
                {busy ? 'Processing…' : quote?.isFree ? 'Activate Free Plan' : `Pay ${formatCurrency(quote?.total ?? 0)}`}
              </button>

              {!quote?.paymentConfigured && !quote?.isFree && (
                <p className="mt-2 text-xs text-amber-600">Payment gateway not configured. Contact platform admin.</p>
              )}

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Lock className="h-3.5 w-3.5" />
                Secured by Cashfree · {quote?.cashfreeMode === 'production' ? 'Live' : 'Sandbox'} payments
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && step === 'plans' && (
        <div className="mt-12 card overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="font-semibold text-gray-900">Billing History</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-6 py-3">Invoice</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Cycle</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={String(p.id)} className="border-t border-gray-100">
                  <td className="px-6 py-3 font-medium">{String(p.invoiceNumber || '—')}</td>
                  <td className="px-6 py-3">{formatCurrency(Number(p.amount))}</td>
                  <td className="px-6 py-3">{String(p.billingCycle)}</td>
                  <td className="px-6 py-3"><StatusBadge status={String(p.status)} /></td>
                  <td className="px-6 py-3 text-gray-500">{new Date(String(p.paidAt || p.createdAt)).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
