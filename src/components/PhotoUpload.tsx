'use client';

import { useState, useRef, useCallback } from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

interface PhotoUploadProps {
  /** Current uploaded image URL (shown as preview) */
  value: string;
  /** Called with the public URL after successful upload */
  onChange: (url: string) => void;
  /** Error message to display */
  error?: string;
  /** Disable interaction */
  disabled?: boolean;
}

export function PhotoUpload({ value, onChange, error, disabled }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayError = error || uploadError;

  const upload = useCallback(
    async (file: File) => {
      setUploadError(null);
      setPreviewError(false);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setUploadError('Please upload a JPEG, PNG, or WebP image.');
        return;
      }
      if (file.size > MAX_SIZE) {
        setUploadError('Image must be under 5 MB.');
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/v1/campaign-photos', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setUploadError(data.error?.message || 'Upload failed. Please try again.');
          return;
        }

        onChange(data.data.url);
      } catch {
        setUploadError('Upload failed. Please check your connection and try again.');
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;

    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled && !uploading) setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function removePhoto() {
    onChange('');
    setUploadError(null);
    setPreviewError(false);
  }

  // ── Preview state ───────────────────────────────────────────────────────
  if (value && !previewError) {
    return (
      <div className="space-y-2">
        <div className="group relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Campaign photo preview"
            className="aspect-[3/2] w-full object-cover"
            onError={() => setPreviewError(true)}
          />
          {!disabled && (
            <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-100"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={removePhoto}
                className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30"
              >
                Remove
              </button>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          aria-hidden="true"
        />
        {displayError && <p className="text-sm text-red-500">{displayError}</p>}
      </div>
    );
  }

  // ── Upload / drop zone ──────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        aria-label="Upload campaign photo"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? 'border-primary bg-primary/5'
            : displayError
              ? 'border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
              : 'border-border hover:border-primary/50 hover:bg-accent/50'
        } ${disabled || uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        {uploading ? (
          <>
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
            <p className="text-sm font-medium text-foreground">Uploading...</p>
          </>
        ) : (
          <>
            {/* Upload icon */}
            <svg
              className="mb-3 h-10 w-10 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
            <p className="text-sm font-medium text-foreground">
              Click to upload or drag and drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, or WebP - up to 5 MB
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        aria-hidden="true"
      />

      {displayError && <p className="text-sm text-red-500">{displayError}</p>}
    </div>
  );
}
