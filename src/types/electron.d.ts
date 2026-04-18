declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        allowpopups?: string
        partition?: string
        useragent?: string
      },
      HTMLElement
    >
  }
}
