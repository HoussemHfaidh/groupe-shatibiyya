# Local import dependencies

These libraries are loaded only after the professor publishes a file. All parsing runs in the browser; files are not sent to an OCR vendor.

- Tesseract.js 6.0.1: https://github.com/naptha/tesseract.js (Apache-2.0, ocr/LICENSE.md).
- Tesseract.js-core 6.0.0, LSTM SIMD and non-SIMD builds: https://github.com/naptha/tesseract.js-core (Apache-2.0, ocr/CORE-LICENSE).
- Arabic model @tesseract.js-data/ara 1.0.0, 4.0.0_best_int: https://github.com/naptha/tessdata (Apache-2.0).
- SheetJS CE 0.20.3: https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js (Apache-2.0, SHEETJS-LICENSE).

Keep versions pinned. Browser caches the Arabic model for subsequent imports. Both core builds are retained for browsers with and without WebAssembly SIMD support.
