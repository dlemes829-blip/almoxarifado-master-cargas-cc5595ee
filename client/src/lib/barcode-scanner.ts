import "barcode-detector/side-effects";

const FORMATS: string[] = ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'itf', 'codabar'];

let detectorInstance: any = null;

async function getDetector(): Promise<any> {
  if (detectorInstance) return detectorInstance;
  
  try {
    if (typeof (window as any).BarcodeDetector !== 'undefined') {
      const BD = (window as any).BarcodeDetector;
      try {
        const supported = await BD.getSupportedFormats();
        const validFormats = FORMATS.filter(f => supported.includes(f));
        detectorInstance = new BD({ formats: validFormats.length > 0 ? validFormats : undefined });
      } catch {
        detectorInstance = new BD({ formats: FORMATS as any });
      }
      return detectorInstance;
    }
  } catch {}

  try {
    const { BarcodeDetector: PolyBD } = await import("barcode-detector/pure");
    try {
      const supported = await PolyBD.getSupportedFormats();
      const validFormats = FORMATS.filter(f => supported.includes(f as any));
      detectorInstance = new PolyBD({ formats: (validFormats.length > 0 ? validFormats : undefined) as any });
    } catch {
      detectorInstance = new PolyBD({ formats: FORMATS as any });
    }
    return detectorInstance;
  } catch {}

  return null;
}

export async function detectBarcode(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<string | null> {
  const detector = await getDetector();
  if (!detector) return null;

  try {
    const barcodes = await detector.detect(source);
    if (barcodes.length > 0) {
      return barcodes[0].rawValue;
    }
  } catch {}

  if (source instanceof HTMLVideoElement && source.readyState >= 2) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = source.videoWidth || 640;
      canvas.height = source.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) {
          return barcodes[0].rawValue;
        }
      }
    } catch {}
  }

  return null;
}

export async function isScannerSupported(): Promise<boolean> {
  const detector = await getDetector();
  return detector !== null;
}

export async function getCamera(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return null;
  }

  const constraints = [
    { video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } },
    { video: { facingMode: "environment" } },
    { video: { facingMode: "user" } },
    { video: true },
  ];
  
  for (const c of constraints) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch {}
  }
  return null;
}
