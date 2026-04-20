import { useEffect, useState, type JSX } from 'react'

const HEIGHT_MESSAGE_TYPE = 'generative-widget:height'
const DEFAULT_WIDGET_HEIGHT = 220
const MIN_WIDGET_HEIGHT = 120
const MAX_WIDGET_HEIGHT = 1400
const SVG_WIDGET_PATTERN = /^\s*<svg[\s>]/i
const FULL_HTML_DOCUMENT_PATTERN = /^\s*(?:<!doctype|<html[\s>]|<body[\s>])/i

const clampHeight = (value: number): number =>
  Math.max(MIN_WIDGET_HEIGHT, Math.min(MAX_WIDGET_HEIGHT, Math.ceil(value)))

const buildResizeScript = (widgetId: string): string => `<script>
(() => {
  const widgetId = ${JSON.stringify(widgetId)};
  const messageType = ${JSON.stringify(HEIGHT_MESSAGE_TYPE)};
  const postHeight = () => {
    const body = document.body;
    const root = document.documentElement;
    const height = Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      root ? root.scrollHeight : 0,
      root ? root.offsetHeight : 0
    );
    window.parent.postMessage({ type: messageType, widgetId, height }, '*');
  };

  const reportSoon = () => {
    postHeight();
    window.requestAnimationFrame(postHeight);
    window.setTimeout(postHeight, 80);
    window.setTimeout(postHeight, 240);
    window.setTimeout(postHeight, 600);
  };

  window.addEventListener('load', reportSoon);
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    reportSoon();
  }

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => postHeight());
    observer.observe(document.documentElement);
    if (document.body) {
      observer.observe(document.body);
    }
  }
})();
</script>`

const injectResizeScript = (documentHtml: string, widgetId: string): string => {
  const resizeScript = buildResizeScript(widgetId)

  if (/<\/body>/i.test(documentHtml)) {
    return documentHtml.replace(/<\/body>/i, `${resizeScript}</body>`)
  }

  if (/<\/html>/i.test(documentHtml)) {
    return documentHtml.replace(/<\/html>/i, `${resizeScript}</html>`)
  }

  return `${documentHtml}${resizeScript}`
}

const buildHtmlDocument = (widget: string, widgetId: string): string => {
  if (FULL_HTML_DOCUMENT_PATTERN.test(widget)) {
    return injectResizeScript(widget, widgetId)
  }

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        overflow: hidden;
      }
      body {
        display: block;
        width: 100%;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      img, svg, canvas {
        max-width: 100%;
      }
    </style>
  </head>
  <body>${widget}${buildResizeScript(widgetId)}</body>
</html>`
}

const isSvgWidget = (widget: string): boolean => SVG_WIDGET_PATTERN.test(widget)

type InlineWidgetRendererProps = {
  widget: string
  widgetId: string
}

const InlineWidgetRenderer = ({ widget, widgetId }: InlineWidgetRendererProps): JSX.Element => {
  const [iframeHeight, setIframeHeight] = useState(DEFAULT_WIDGET_HEIGHT)

  useEffect(() => {
    setIframeHeight(DEFAULT_WIDGET_HEIGHT)
  }, [widget])

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      if (typeof event.data !== 'object' || event.data === null) {
        return
      }

      const candidate = event.data as Record<string, unknown>
      if (candidate.type !== HEIGHT_MESSAGE_TYPE || candidate.widgetId !== widgetId) {
        return
      }

      const height = candidate.height
      if (typeof height !== 'number' || !Number.isFinite(height)) {
        return
      }

      const nextHeight = clampHeight(height)
      setIframeHeight((current) => (current === nextHeight ? current : nextHeight))
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [widgetId])

  const surfaceClassName = 'bg-background'

  if (isSvgWidget(widget)) {
    return (
      <div className={surfaceClassName}>
        <div
          className="w-full [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: widget }}
        />
      </div>
    )
  }

  return (
    <div className={`overflow-hidden ${surfaceClassName}`}>
      <iframe
        title="Generative UI"
        srcDoc={buildHtmlDocument(widget, widgetId)}
        sandbox="allow-scripts"
        scrolling="no"
        className="block w-full border-0 bg-transparent"
        style={{ height: `${iframeHeight}px` }}
      />
    </div>
  )
}

export default InlineWidgetRenderer
