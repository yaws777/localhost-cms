import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

const fileUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `http://localhost:3001${url.startsWith('/') ? '' : '/'}${url}`;
};

// Preview of a proof: a File the student just picked, or one already saved on the server ({ file_url, original_name }).
// Image = thumbnail, PDF = small embedded viewer. Both have an "open in a new tab" link.
export default function ProofPreview({ file, saved, tall = false }) {
    const [blobUrl, setBlobUrl] = useState('');

    useEffect(() => {
        if (!file) { setBlobUrl(''); return undefined; }
        const url = URL.createObjectURL(file);
        setBlobUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const src = file ? blobUrl : fileUrl(saved?.file_url);
    const name = file ? file.name : (saved?.original_name || 'Saved file');
    const isImage = file ? file.type.startsWith('image/') : /\.(png|jpe?g|gif|webp|bmp)$/i.test(saved?.file_url || '');
    const isPdf = file ? file.type === 'application/pdf' : /\.pdf$/i.test(saved?.file_url || '');
    if (!src) return null;

    return (
        <figure className={`proof-preview${tall ? ' proof-preview-tall' : ''}`}>
            {isImage && <img src={src} alt={`Preview of ${name}`} />}
            {isPdf && <iframe src={src} title={`Preview of ${name}`} />}
            {!isImage && !isPdf && <p className="proof-name">No preview for this file type.</p>}
            <figcaption>
                <span className="proof-name">{name}{file ? ` (${Math.max(1, Math.round(file.size / 1024))} KB)` : ''}</span>
                <a
                    className="proof-open"
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${name} in a new tab`}
                    title="Open in a new tab"
                >
                    <ExternalLink size={16} aria-hidden="true" />
                </a>
            </figcaption>
        </figure>
    );
}
