import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { api, apiBaseUrl } from '@/lib/api';

function resolveImageUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  if (url.startsWith('/api/')) return `${apiBaseUrl.replace(/\/api\/v1$/, '')}${url}`;
  return url;
}

interface ImageUploadProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  folder?: 'logos' | 'favicons' | 'images' | 'covers' | 'photos';
  accept?: string;
  hint?: string;
  previewClassName?: string;
}

export function ImageUpload({
  label,
  value,
  onChange,
  folder = 'images',
  accept = 'image/*',
  hint,
  previewClassName = 'h-20 w-20',
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const res = await api.uploadFile(file, folder);
      if (res.success && res.data) {
        onChange((res.data as { url: string }).url);
      } else {
        setError(res.error || 'Upload failed');
      }
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const previewUrl = value ? resolveImageUrl(value) : '';

  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <div className="flex items-start gap-4">
        {previewUrl ? (
          <div className="relative">
            <img src={previewUrl} alt="" className={`${previewClassName} rounded-lg border object-cover bg-gray-50`} />
            <button
              type="button"
              className="absolute -top-2 -right-2 p-1 bg-white border rounded-full shadow text-gray-500 hover:text-red-600"
              onClick={() => onChange('')}
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className={`${previewClassName} rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50`}>
            <Upload className="h-6 w-6 text-gray-300" />
          </div>
        )}
        <div className="flex-1">
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onInputChange} />
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Uploading...' : previewUrl ? 'Change Image' : 'Upload Image'}
          </button>
          {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export { resolveImageUrl };
