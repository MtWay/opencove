export interface TerminalClipboardSnapshot {
  text: string
  hasImage: boolean
  /**
   * Absolute path of a temp PNG holding the clipboard image, when the
   * platform could persist it. Lets terminals paste images as file paths for
   * agents whose native image-paste keys do not work in embedded terminals.
   */
  imageFilePath?: string | null
}

export interface WriteClipboardTextInput {
  text: string
}
