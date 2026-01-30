// 类型声明，消除对 pdfjs-dist 各种打包/URL 导入的 TS 报错
declare module 'pdfjs-dist/legacy/build/pdf' {
  const pdfjs: any
  export = pdfjs
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.min?url' {
  const url: string
  export default url
}

declare module 'pdfjs-dist/build/pdf.worker.min?url' {
  const url: string
  export default url
}

declare module 'pdfjs-dist/build/pdf.min.mjs' {
  const pdfjs: any
  export = pdfjs
}

declare module 'pdfjs-dist' {
  const pdfjs: any
  export = pdfjs
}

// 支持 ?url 等 Vite 风格导入
declare module '*?url' {
  const url: string
  export default url
}

export {}
