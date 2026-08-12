import {
  KnowledgeUploadFile,
  MAX_KNOWLEDGE_UPLOAD_BYTES,
  validateKnowledgeUpload,
} from '../../../src/services/knowledgeUploadPolicy'

const makeFile = (overrides: Partial<KnowledgeUploadFile> = {}): KnowledgeUploadFile =>
  ({
    fieldname: 'file',
    originalname: 'guide.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 12,
    buffer: Buffer.from('%PDF-1.7\nbody'),
    ...overrides,
  })

describe('knowledgeUploadPolicy', () => {
  it('accepts PDF, DOCX and plain text only when their bytes match the declared type', () => {
    expect(validateKnowledgeUpload(makeFile())).toMatchObject({ extension: '.pdf' })
    expect(
      validateKnowledgeUpload(
        makeFile({
          originalname: 'worksheet.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
        })
      )
    ).toMatchObject({ extension: '.docx' })
    expect(
      validateKnowledgeUpload(
        makeFile({
          originalname: 'notes.txt',
          mimetype: 'text/plain',
          buffer: Buffer.from('呼吸训练步骤', 'utf8'),
        })
      )
    ).toMatchObject({ extension: '.txt' })
  })

  it('rejects an executable renamed to PDF instead of trusting MIME or extension', () => {
    expect(() =>
      validateKnowledgeUpload(makeFile({ buffer: Buffer.from('MZfake executable') }))
    ).toThrow('文件内容与声明类型不一致')
  })

  it('rejects unsupported types and oversized files with explicit safe errors', () => {
    expect(() =>
      validateKnowledgeUpload(
        makeFile({ originalname: 'script.html', mimetype: 'text/html', buffer: Buffer.from('<script>') })
      )
    ).toThrow('仅支持 PDF、DOCX 和 TXT 文件')

    expect(() =>
      validateKnowledgeUpload(makeFile({ size: MAX_KNOWLEDGE_UPLOAD_BYTES + 1 }))
    ).toThrow('文件大小不能超过 10MB')
  })
})
