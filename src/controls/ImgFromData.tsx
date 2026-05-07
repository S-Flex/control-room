import { useEffect, useMemo, useState } from 'react';

type ImgFromDataProps = {
  data: number[];
  alt?: string;
  className?: string;
};

export function ImgFromData({ data, alt = '', className = '' }: ImgFromDataProps) {
  const [url, setUrl] = useState<string | null>(null);

  // Sniff the MIME from the file's magic bytes; the API returns raw bytes
  // without a content-type, so the browser needs us to label the Blob.
  const mime = useMemo(() => {
    if (!data || data.length < 4) return null;
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png';
    if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
    return 'application/octet-stream';
  }, [data]);

  useEffect(() => {
    if (!data || data.length === 0 || !mime) {
      setUrl(null);
      return;
    }
    const blob = new Blob([new Uint8Array(data)], { type: mime });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [data, mime]);

  if (!url) return null;

  return <img src={url} alt={alt} className={className} />;
}
