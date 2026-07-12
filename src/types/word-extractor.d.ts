declare module 'word-extractor' {
  interface WordDocument {
    getBody: () => string
  }

  export default class WordExtractor {
    extract: (source: Buffer) => Promise<WordDocument>
  }
}
