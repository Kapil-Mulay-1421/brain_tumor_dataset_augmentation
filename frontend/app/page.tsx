'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Method = 'lerp' | 'slerp';

// ─── Constants ────────────────────────────────────────────────────────────────

const NUM_FRAMES = 50;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function b64ToImg(b64: string) {
  return `data:image/png;base64,${b64}`;
}

async function generateOne(): Promise<{ image: string; latent: number[] }> {
  const res = await fetch(`${API_URL}/generate`, { method: 'POST' });
  const data = await res.json();
  return { image: b64ToImg(data.image), latent: data.latent };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ blue }: { blue?: boolean }) {
  return <span className={`spinner ${blue ? 'spinner-blue' : ''}`} />;
}

function ImagePlaceholder({ text }: { text: string }) {
  return (
    <div className="img-placeholder">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

function LerpSlerpDiagram() {
  return (
    <svg
      viewBox="0 0 340 140"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: 340, display: 'block' }}
      aria-label="LERP vs SLERP geometry diagram"
    >
      {/* Background */}
      <rect width="340" height="140" rx="10" fill="#f8fafc" />

      {/* LERP side */}
      <text x="80" y="20" textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569" letterSpacing="1">LERP</text>
      {/* Straight line */}
      <line x1="20" y1="100" x2="140" y2="100" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="20" y1="100" x2="140" y2="100" stroke="#3b82f6" strokeWidth="2.5" />
      {/* Points */}
      <circle cx="20" cy="100" r="5" fill="#3b82f6" />
      <circle cx="140" cy="100" r="5" fill="#3b82f6" />
      <circle cx="80" cy="100" r="4" fill="#93c5fd" />
      {/* Labels */}
      <text x="20" y="118" textAnchor="middle" fontSize="10" fill="#64748b">A</text>
      <text x="140" y="118" textAnchor="middle" fontSize="10" fill="#64748b">B</text>
      <text x="80" y="90" textAnchor="middle" fontSize="9" fill="#3b82f6">straight path</text>

      {/* Divider */}
      <line x1="170" y1="15" x2="170" y2="130" stroke="#e2e8f0" strokeWidth="1" />

      {/* SLERP side */}
      <text x="260" y="20" textAnchor="middle" fontSize="11" fontWeight="700" fill="#475569" letterSpacing="1">SLERP</text>
      {/* Sphere arc */}
      <circle cx="260" cy="115" r="65" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 3" />
      <path d="M 198 100 A 65 65 0 0 1 322 100" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
      {/* Points */}
      <circle cx="198" cy="100" r="5" fill="#3b82f6" />
      <circle cx="322" cy="100" r="5" fill="#3b82f6" />
      <circle cx="260" cy="50" r="4" fill="#93c5fd" />
      {/* Labels */}
      <text x="198" y="118" textAnchor="middle" fontSize="10" fill="#64748b">A</text>
      <text x="322" y="118" textAnchor="middle" fontSize="10" fill="#64748b">B</text>
      <text x="260" y="42" textAnchor="middle" fontSize="9" fill="#3b82f6">arc on sphere</text>
    </svg>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Enlarged scan"
        className="modal-img fade-in"
        onClick={e => e.stopPropagation()}
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  // Single generation
  const [image, setImage] = useState<string | null>(null);
  const [loadingGen, setLoadingGen] = useState(false);

  // Interpolation
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  const [latentA, setLatentA] = useState<number[] | null>(null);
  const [latentB, setLatentB] = useState<number[] | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [interpolating, setInterpolating] = useState(false);

  const [lerpFrames, setLerpFrames] = useState<string[]>([]);
  const [slerpFrames, setSlerpFrames] = useState<string[]>([]);
  const [sliderValue, setSliderValue] = useState(0);
  const [method, setMethod] = useState<Method>('slerp');

  // Gallery
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [modalSrc, setModalSrc] = useState<string | null>(null);

  // GIF
  const [downloadingGif, setDownloadingGif] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── API calls ────────────────────────────────────────────────────────────────

  const generateImage = async () => {
    try {
      setLoadingGen(true);
      const { image } = await generateOne();
      setImage(image);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGen(false);
    }
  };

  const generateA = async () => {
    try {
      setLoadingA(true);
      const { image, latent } = await generateOne();
      setImageA(image);
      setLatentA(latent);
      // Reset interpolation when A changes
      setLerpFrames([]);
      setSlerpFrames([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingA(false);
    }
  };

  const generateB = async () => {
    try {
      setLoadingB(true);
      const { image, latent } = await generateOne();
      setImageB(image);
      setLatentB(latent);
      // Reset interpolation when B changes
      setLerpFrames([]);
      setSlerpFrames([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingB(false);
    }
  };

  const interpolate = async () => {
    if (!latentA || !latentB) return;
    try {
      setInterpolating(true);
      const res = await fetch(`${API_URL}/interpolate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latentA, latentB, num_frames: NUM_FRAMES }),
      });
      const data = await res.json();
      const lerp = data.lerp_frames.map(b64ToImg);
      const slerp = data.slerp_frames.map(b64ToImg);
      setLerpFrames(lerp);
      setSlerpFrames(slerp);
      setSliderValue(0);
      setMethod('slerp');
    } catch (err) {
      console.error(err);
    } finally {
      setInterpolating(false);
    }
  };

  const loadGallery = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 18 }),
      });
      const data = await res.json();
      setGalleryImages(data.images.map(b64ToImg));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { loadGallery(); }, [loadGallery]);

  // ── Slider ───────────────────────────────────────────────────────────────────

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(e.target.value));
  };

  // ── Current frames per method ────────────────────────────────────────────────

  const currentLerpImg  = lerpFrames[sliderValue]  ?? null;
  const currentSlerpImg = slerpFrames[sliderValue] ?? null;
  const hasFrames = lerpFrames.length > 0 && slerpFrames.length > 0;

  // ── GIF download (pure canvas, no dependencies) ──────────────────────────────

  const downloadGif = async () => {
    const frames = method === 'slerp' ? slerpFrames : lerpFrames;
    if (!frames.length) return;
    setDownloadingGif(true);

    try {
      // --- Minimal GIF89a encoder (no external libs, no web workers) ---

      // LZW encoder
      function lzwEncode(pixels: number[], colorDepth: number): number[] {
        const clearCode = 1 << colorDepth;
        const eofCode = clearCode + 1;
        let codeSize = colorDepth + 1;
        let maxCode = 1 << codeSize;

        const output: number[] = [];
        let buf = 0, bufBits = 0;

        function writeBits(code: number, bits: number) {
          buf |= code << bufBits;
          bufBits += bits;
          while (bufBits >= 8) { output.push(buf & 0xff); buf >>= 8; bufBits -= 8; }
        }

        const table = new Map<string, number>();
        let nextCode = eofCode + 1;

        function reset() {
          table.clear();
          for (let i = 0; i < clearCode; i++) table.set(String(i), i);
          codeSize = colorDepth + 1;
          maxCode = 1 << codeSize;
          nextCode = eofCode + 1;
        }

        reset();
        writeBits(clearCode, codeSize);

        let index = 0;
        let str = String(pixels[index++]);

        while (index < pixels.length) {
          const c = String(pixels[index++]);
          const sc = str + ',' + c;
          if (table.has(sc)) {
            str = sc;
          } else {
            writeBits(table.get(str)!, codeSize);
            if (nextCode < 4096) {
              table.set(sc, nextCode++);
              if (nextCode > maxCode && codeSize < 12) { codeSize++; maxCode <<= 1; }
            } else {
              writeBits(clearCode, codeSize);
              reset();
            }
            str = c;
          }
        }
        writeBits(table.get(str)!, codeSize);
        writeBits(eofCode, codeSize);
        if (bufBits > 0) output.push(buf & 0xff);
        return output;
      }

      // Build a fixed 256-color palette by sampling the first frame
      const W = 64, H = 64;
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // Load all frames as ImageData
      const frameData: ImageData[] = [];
      for (const src of frames) {
        await new Promise<void>(resolve => {
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, 0, 0, W, H); frameData.push(ctx.getImageData(0, 0, W, H)); resolve(); };
          img.src = src;
        });
      }

      // Simple median-cut palette: just use first frame's distinct colours up to 256
      // For 64×64 grayscale-ish MRI images this works very well
      const palette: number[][] = [];
      const seen = new Set<number>();
      for (const fd of frameData) {
        for (let i = 0; i < fd.data.length; i += 4) {
          const r = fd.data[i], g = fd.data[i+1], b = fd.data[i+2];
          const key = (r << 16) | (g << 8) | b;
          if (!seen.has(key)) { seen.add(key); palette.push([r, g, b]); }
          if (palette.length >= 256) break;
        }
        if (palette.length >= 256) break;
      }
      while (palette.length < 256) palette.push([0, 0, 0]);

      // Map pixel → nearest palette index (Euclidean distance)
      const paletteMap = new Map<number, number>();
      function nearestIdx(r: number, g: number, b: number): number {
        const key = (r << 16) | (g << 8) | b;
        if (paletteMap.has(key)) return paletteMap.get(key)!;
        let best = 0, bestD = Infinity;
        for (let i = 0; i < palette.length; i++) {
          const dr = r - palette[i][0], dg = g - palette[i][1], db = b - palette[i][2];
          const d = dr*dr + dg*dg + db*db;
          if (d < bestD) { bestD = d; best = i; }
        }
        paletteMap.set(key, best);
        return best;
      }

      // --- Assemble GIF bytes ---
      const bytes: number[] = [];
      const push = (...args: number[]) => bytes.push(...args);
      const pushStr = (s: string) => { for (let i = 0; i < s.length; i++) push(s.charCodeAt(i)); };
      const push16 = (n: number) => push(n & 0xff, (n >> 8) & 0xff);

      // Header
      pushStr('GIF89a');
      push16(W); push16(H);
      push(0xf7, 0x00, 0x00); // GCT flag, bg=0, aspect=0

      // Global colour table (256 × 3 bytes)
      for (const [r, g, b] of palette) push(r, g, b);

      // Netscape loop extension (loop forever)
      push(0x21, 0xff, 0x0b);
      pushStr('NETSCAPE2.0');
      push(0x03, 0x01, 0x00, 0x00, 0x00);

      const DELAY = 6; // × 10ms = 60ms per frame

      for (const fd of frameData) {
        // Graphic control extension
        push(0x21, 0xf9, 0x04, 0x00);
        push16(DELAY);
        push(0x00, 0x00);

        // Image descriptor
        push(0x2c);
        push16(0); push16(0); push16(W); push16(H);
        push(0x00); // no local colour table

        // Quantise pixels
        const indices: number[] = [];
        for (let i = 0; i < fd.data.length; i += 4) {
          indices.push(nearestIdx(fd.data[i], fd.data[i+1], fd.data[i+2]));
        }

        // LZW-compress
        const colorDepth = 8;
        push(colorDepth);
        const compressed = lzwEncode(indices, colorDepth);

        // Write in sub-blocks of max 255 bytes
        let off = 0;
        while (off < compressed.length) {
          const block = compressed.slice(off, off + 255);
          push(block.length, ...block);
          off += 255;
        }
        push(0x00); // block terminator
      }

      push(0x3b); // GIF trailer

      // Download
      const blob = new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tumor_interpolation_${method}.gif`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('GIF export failed:', err);
    } finally {
      setDownloadingGif(false);
    }
  };

  // ── Interpolate section readiness ────────────────────────────────────────────

  const canInterpolate = !!latentA && !!latentB && !interpolating;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {modalSrc && <Modal src={modalSrc} onClose={() => setModalSrc(null)} />}

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <header style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 60%, #0f2744 100%)',
        color: 'white',
        padding: '80px 24px 72px',
      }}>
        <div className="section-inner">
          <div style={{ marginBottom: 12 }}>
            <span className="badge badge-blue" style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', borderColor: 'rgba(59,130,246,0.3)' }}>
              Research Demo
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 52px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            margin: '0 0 20px',
            maxWidth: 700,
          }}>
            Brain MRI Tumor Augmentation{' '}
            <span style={{ color: '#60a5fa' }}>using GANs</span>
          </h1>

          <p style={{
            fontSize: 'clamp(14px, 2vw, 17px)',
            color: '#94a3b8',
            lineHeight: 1.75,
            maxWidth: 580,
            margin: '0 0 40px',
          }}>
            A Deep Convolutional GAN (DCGAN) trained on brain MRI tumor scans to generate
            synthetic images and explore the learned latent space through LERP and SLERP
            interpolation.
          </p>

          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Architecture', value: 'DCGAN' },
              { label: 'Resolution', value: '64 × 64 px' },
              { label: 'FID Score', value: '139.55' },
              { label: 'Epochs', value: '100' },
              { label: 'Learning Rate', value: '0.0002' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '14px 20px',
                backdropFilter: 'blur(8px)',
                minWidth: 110,
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: 2 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── GENERATE SINGLE ──────────────────────────────────────── */}
      <section className="page-section">
        <div className="section-inner">
<p className="section-label">Generation</p>
      <h2 className="section-title">Generate a Random Tumor</h2>
          <p className="section-desc" style={{ marginBottom: 32 }}>
            Sample a random point from the 100-dimensional latent space and decode it through
            the trained generator to produce a synthetic MRI scan.
          </p>

          <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button className="btn btn-primary" onClick={generateImage} disabled={loadingGen} style={{ width: 'fit-content' }}>
                {loadingGen ? <><Spinner /> Generating…</> : (
                  <>
                    {/* <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg> */}
                    Generate Tumor
                  </>
                )}
              </button>
              {!image && !loadingGen && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                  Click to generate your first synthetic scan.
                </p>
              )}
            </div>

            <div style={{ width: 200 }}>
              {loadingGen ? (
                <div className="img-placeholder" style={{ width: 200, height: 200 }}>
                  <Spinner blue />
                  <span>Sampling latent vector…</span>
                </div>
              ) : image ? (
                <div className="card" style={{ padding: 8, width: 'fit-content' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt="Generated tumor scan"
                    className="slide-up"
                    style={{ width: 184, height: 184, borderRadius: 6, display: 'block', imageRendering: 'pixelated' }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                    synthetic MRI · 64×64 px
                  </p>
                </div>
              ) : (
                <div className="img-placeholder" style={{ width: 200, height: 200 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span>Generate an image<br/>to begin</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ── GALLERY ──────────────────────────────────────────────── */}
      <section className="page-section">
        <div className="section-inner">
<p className="section-label">Gallery</p>
      <h2 className="section-title">Sample Generated Tumors</h2>
      <p className="section-desc" style={{ marginBottom: 32 }}>
        A batch of 18 synthetic scans sampled from across the latent space — generated
            freshly on page load.
          </p>

          {galleryImages.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
            }}>
              {galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  className="gallery-img-wrap"
                  onClick={() => setModalSrc(img)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View scan ${idx + 1}`}
                  onKeyDown={e => { if (e.key === 'Enter') setModalSrc(img); }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={`Generated scan ${idx + 1}`} style={{ imageRendering: 'pixelated' }} />
                  <div className="overlay">View</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="img-placeholder" style={{ minHeight: 120 }}>
                  <Spinner blue />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── LATENT SPACE INTERPOLATION ───────────────────────────── */}
      <section className="page-section-dark">
        <div className="section-inner">
          <h2 className="section-title section-title-light">Latent Space Interpolation</h2>
          <p className="section-desc section-desc-light" style={{ marginBottom: 20 }}>
            Generate two distinct tumor scans, then interpolate through the latent space
            between them. The GAN decodes each intermediate point into a unique image —
            revealing how the model organises learned features.
          </p>

          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {[
                { src: '/tumor_interpolation_start.png', title: 'Example Image A', alt: 'Example Image A' },
                { src: '/tumor_interpolation_lerp.gif', title: 'LERP', alt: 'LERP from A to B' },
                { src: '/tumor_interpolation_slerp.gif', title: 'SLERP', alt: 'SLERP from A to B' },
                { src: '/tumor_interpolation_end.png', title: 'Example Image B', alt: 'Example Image B' },
              ].map((item) => (
                <div key={item.src} className="card-dark" style={{ padding: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.src}
                    alt={item.alt}
                    loading="lazy"
                    style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', borderRadius: 8, display: 'block', imageRendering: 'pixelated', background: '#020617' }}
                  />
                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: '#cbd5e1', textAlign: 'center' }}>
                    {item.title}
                  </div>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', marginTop: 50, marginBottom: 8 }}>
              Try interpolation yourself
            </h3>
            <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, marginBottom: 0 }}>
              Generate images A and B and click "interpolate" to explore the latent path.
            </p>
          </div>

          {/* A | LERP | SLERP | B — four columns, collapses on mobile */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            alignItems: 'start',
          }}
            className="interp-grid"
          >
            {/* Image A */}
            <div className="card-dark" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Image A
                </span>
                {latentA && <span style={{ fontSize: 10, color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>latent ✓</span>}
              </div>
              {loadingA ? (
                <div className="img-placeholder" style={{ background: '#0f172a', borderColor: '#334155' }}>
                  <Spinner />
                  <span style={{ color: '#64748b' }}>Sampling…</span>
                </div>
              ) : imageA ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageA} alt="Image A" className="slide-up"
                  style={{ width: '100%', aspectRatio: '1', borderRadius: 8, display: 'block', imageRendering: 'pixelated' }} />
              ) : (
                <div className="img-placeholder" style={{ background: '#0f172a', borderColor: '#334155', color: '#475569' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                  <span>No image yet</span>
                </div>
              )}
              <button className="btn btn-primary btn-sm" onClick={generateA} disabled={loadingA}
                style={{ width: '100%' }}>
                {loadingA ? <><Spinner /> Generating…</> : 'Generate A'}
              </button>
            </div>

            {/* LERP current */}
            <div className="card-dark" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, outline: method === 'lerp' && hasFrames ? '2px solid #3b82f6' : '2px solid transparent', outlineOffset: 2, transition: 'outline-color 0.2s' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: method === 'lerp' && hasFrames ? '#60a5fa' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', transition: 'color 0.2s' }}>
                LERP
              </span>
              {currentLerpImg ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={currentLerpImg} alt="LERP frame"
                  style={{ width: '100%', aspectRatio: '1', borderRadius: 8, display: 'block', imageRendering: 'pixelated' }} />
              ) : (
                <div className="img-placeholder" style={{ background: '#0f172a', borderColor: '#334155', color: '#475569' }}>
                  {interpolating ? <><Spinner /><span style={{ color: '#64748b' }}>Computing…</span></> : <span>Run interpolation</span>}
                </div>
              )}
              <span style={{ fontSize: 11, color: '#475569', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                Linear path
              </span>
            </div>

            {/* SLERP current */}
            <div className="card-dark" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, outline: method === 'slerp' && hasFrames ? '2px solid #3b82f6' : '2px solid transparent', outlineOffset: 2, transition: 'outline-color 0.2s' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: method === 'slerp' && hasFrames ? '#60a5fa' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', transition: 'color 0.2s' }}>
                SLERP
              </span>
              {currentSlerpImg ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={currentSlerpImg} alt="SLERP frame"
                  style={{ width: '100%', aspectRatio: '1', borderRadius: 8, display: 'block', imageRendering: 'pixelated' }} />
              ) : (
                <div className="img-placeholder" style={{ background: '#0f172a', borderColor: '#334155', color: '#475569' }}>
                  {interpolating ? <><Spinner /><span style={{ color: '#64748b' }}>Computing…</span></> : <span>Run interpolation</span>}
                </div>
              )}
              <span style={{ fontSize: 11, color: '#475569', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                Spherical arc
              </span>
            </div>

            {/* Image B */}
            <div className="card-dark" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Image B
                </span>
                {latentB && <span style={{ fontSize: 10, color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>latent ✓</span>}
              </div>
              {loadingB ? (
                <div className="img-placeholder" style={{ background: '#0f172a', borderColor: '#334155' }}>
                  <Spinner />
                  <span style={{ color: '#64748b' }}>Sampling…</span>
                </div>
              ) : imageB ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageB} alt="Image B" className="slide-up"
                  style={{ width: '100%', aspectRatio: '1', borderRadius: 8, display: 'block', imageRendering: 'pixelated' }} />
              ) : (
                <div className="img-placeholder" style={{ background: '#0f172a', borderColor: '#334155', color: '#475569' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                  <span>No image yet</span>
                </div>
              )}
              <button className="btn btn-primary btn-sm" onClick={generateB} disabled={loadingB}
                style={{ width: '100%' }}>
                {loadingB ? <><Spinner /> Generating…</> : 'Generate B'}
              </button>
            </div>
          </div>

          {/* Interpolate button */}
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {!latentA || !latentB ? (
              <p style={{ fontSize: 13, color: '#475569' }}>
                Generate Image A and Image B first, then click Interpolate.
              </p>
            ) : null}
            <button
              className="btn btn-primary"
              onClick={interpolate}
              disabled={!canInterpolate}
              style={{ minWidth: 160 }}
            >
              {interpolating ? <><Spinner /> Interpolating…</> : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  Interpolate
                </>
              )}
            </button>
          </div>

          {/* Slider + method toggle */}
          {hasFrames && (
            <div className="card-dark slide-up" style={{ marginTop: 28, padding: 24 }}>

              {/* Method toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div className="segmented" style={{ background: '#0f172a', borderColor: '#334155' }}>
                  <button
                    className={method === 'lerp' ? 'active' : ''}
                    onClick={() => setMethod('lerp')}
                  >
                    LERP
                  </button>
                  <button
                    className={method === 'slerp' ? 'active' : ''}
                    onClick={() => setMethod('slerp')}
                  >
                    SLERP
                  </button>
                </div>
              </div>

              {/* Frame counter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                  Frame {sliderValue + 1} / {NUM_FRAMES}
                </span>
                <span style={{ fontSize: 13, color: '#60a5fa', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {Math.round((sliderValue / (NUM_FRAMES - 1)) * 100)}% through interpolation
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={NUM_FRAMES - 1}
                value={sliderValue}
                onChange={handleSliderChange}
                className="range-slider"
              />

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={downloadGif} disabled={downloadingGif} style={{ minWidth: 160 }}>
                  {downloadingGif ? <><Spinner /> Building GIF…</> : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download {method.toUpperCase()} GIF
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── LERP VS SLERP EXPLAINED ──────────────────────────────── */}
      <section className="page-section">
        <div className="section-inner">
          <p className="section-label">Understanding the methods</p>
          <h2 className="section-title">LERP vs SLERP</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginTop: 32 }}>
            {/* LERP card */}
            <div className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{
                  background: 'rgba(59,130,246,0.1)', color: '#2563eb',
                  borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.06em', fontFamily: 'var(--font-mono)',
                }}>LERP</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Linear Interpolation</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
                Moves directly between two latent vectors along a straight line in Euclidean space.
                Simple and fast, but the midpoint of a straight line in high-dimensional space
                often lands in a low-density region of the learned distribution.
              </p>
              <code style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 6, display: 'block' }}>
                z = (1−t)·zA + t·zB
              </code>
            </div>

            {/* SLERP card */}
            <div className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{
                  background: 'rgba(16,185,129,0.1)', color: '#059669',
                  borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.06em', fontFamily: 'var(--font-mono)',
                }}>SLERP</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Spherical Interpolation</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
                Follows the surface of the latent hypersphere, maintaining a constant magnitude
                at every step. This keeps intermediate points within the high-density region
                of the latent space, typically yielding smoother and more realistic transitions.
              </p>
              <code style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 6, display: 'block' }}>
                z = sin((1−t)Ω)/sin(Ω)·zA + sin(tΩ)/sin(Ω)·zB
              </code>
            </div>
          </div>

          {/* Diagram */}
          <div className="card" style={{ marginTop: 24, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 4 }}>
              Geometric intuition — LERP cuts across; SLERP follows the arc of the hypersphere
            </p>
            <LerpSlerpDiagram />
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ── TECHNICAL DETAILS ────────────────────────────────────── */}
      <section className="page-section">
        <div className="section-inner">
          <p className="section-label">Under the hood</p>
          <h2 className="section-title">Technical Details</h2>
          <p className="section-desc" style={{ marginBottom: 36 }}>
            A full-stack ML research demo built with modern tooling from model training through to the interactive frontend.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { title: 'DCGAN Architecture', desc: 'Deep Convolutional GAN with BatchNorm, ReLU generator and LeakyReLU discriminator.', icon: '🧠' },
              { title: 'Brain MRI Dataset', desc: 'Trained on labelled brain MRI tumor scans sourced from Kaggle.', icon: '🩻' },
              { title: 'FID Evaluation', desc: 'Fréchet Inception Distance of 139.55 measures distributional similarity to real scans.', icon: '📊' },
              { title: 'Latent Interpolation', desc: '50-frame interpolations computed server-side and returned as base64 frame sequences.', icon: '🔀' },
              { title: 'LERP vs SLERP', desc: 'Both paths computed per request, enabling instant client-side toggling with no extra API calls.', icon: '📐' },
              { title: 'FastAPI Backend', desc: 'Async Python backend serves generation and interpolation endpoints with PyTorch inference.', icon: '⚡' },
              { title: 'Next.js Frontend', desc: 'React Server / Client components, TailwindCSS v4, in-browser GIF encoding.', icon: '🌐' },
              { title: 'PyTorch Training', desc: 'Model trained using PyTorch with Adam optimiser, lr 0.0002, β₁ 0.5 for 100 epochs.', icon: '🔥' },
            ].map(item => (
              <div key={item.title} className="card" style={{ padding: 20 }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{item.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer style={{ background: 'var(--bg-dark)', color: 'var(--text-on-dark-muted)', padding: '40px 24px' }}>
        <div className="section-inner" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-on-dark)', marginBottom: 6 }}>
                Brain MRI Tumor GAN
              </div>
              <div style={{ fontSize: 13 }}>
                A latent space exploration demo · Kapil Mulay
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['PyTorch', 'FastAPI', 'Next.js', 'TailwindCSS'].map(t => (
                <span key={t} className="tech-tag" style={{
                  background: 'rgba(59,130,246,0.08)',
                  borderColor: 'rgba(59,130,246,0.15)',
                  color: '#60a5fa',
                }}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #1e293b' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12 }}>
              Open-source research project
            </span>
            <a
              href="https://github.com/Kapil-Mulay-1421/brain_tumor_dataset_augmentation"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.38 7.86 10.9.57.1.78-.25.78-.55v-1.93c-3.19.69-3.86-1.54-3.86-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.14 1.17A10.9 10.9 0 0112 6.84c.97 0 1.95.13 2.86.39 2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* ── Responsive grid override ──────────────────────────────── */}
      <style>{`
        @media (max-width: 900px) {
          .interp-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 550px) {
          .interp-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}
