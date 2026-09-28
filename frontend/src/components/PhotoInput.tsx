import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MAX_BYTES = 500 * 1024;

/** Optional photo picker that returns the image as a data URL (kept under ~500 KB for the API). */
export function PhotoInput({ value, onChange, label = 'Photo (optional)' }: { value: string | null; onChange: (dataUrl: string | null) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image is larger than 500 KB. Choose a smaller photo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  }

  return (
    <div className="mb-4 space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {value ? (
        <div className="relative w-fit">
          <img src={value} alt="Selected" className="h-28 rounded-md border object-cover" />
          <Button type="button" variant="outline" size="icon-xs" className="absolute -top-2 -right-2 bg-background" onClick={() => onChange(null)} aria-label="Remove photo">
            <X />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <ImagePlus /> Add photo
        </Button>
      )}
      <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} aria-label={label} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
