/** Browser implementation of the cursor/canvas subset used by the eight archived reports.
 * Keep the report sources unchanged. Unsupported chart modes fail explicitly so a future
 * report cannot silently acquire a different meaning during export.
 */
import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export { useState };

declare global {
  interface Window {
    __reportOpenFile: (path: string) => void;
    __reportFileUrl: (path: string) => string;
  }
}

type BaseProps = { children?: ReactNode; style?: CSSProperties };
type Align = 'start' | 'center' | 'end' | 'stretch';
type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
const variable = (name: string) => `var(--report-${name})`;
const themeTokens = {
  text: { primary: variable('text'), secondary: variable('secondary'), tertiary: variable('muted'), quaternary: variable('muted'), link: variable('accent'), onAccent: variable('on-accent') },
  bg: { editor: variable('bg'), chrome: variable('surface'), elevated: variable('surface') },
  fill: { primary: variable('fill-strong'), secondary: variable('fill'), tertiary: variable('subtle'), quaternary: variable('subtle') },
  stroke: { primary: variable('stroke'), secondary: variable('stroke'), tertiary: variable('stroke-soft'), focused: variable('accent') },
  accent: { primary: variable('accent'), control: variable('accent'), controlHover: variable('accent-hover') },
};

export function useHostTheme() {
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);
  return { ...themeTokens, kind: dark ? 'dark' : 'light', tokens: themeTokens };
}

const dispatchAction = (action: { type: string; path?: string; selection?: unknown }) => {
  if (action.type !== 'openFile' || typeof action.path !== 'string' || action.selection !== undefined) {
    throw new Error('This report viewer supports only openFile actions without a text selection.');
  }
  if (typeof window.__reportOpenFile !== 'function') throw new Error('Report file navigation is unavailable.');
  window.__reportOpenFile(action.path);
};
export function useCanvasAction() { return dispatchAction; }

export function Stack({ children, gap = 12, style }: BaseProps & { gap?: number }) {
  return <div className="report-stack" style={{ gap, ...style }}>{children}</div>;
}
export function Row({ children, gap = 8, align = 'center', justify = 'start', wrap = false, style }: BaseProps & { gap?: number; align?: Align; justify?: 'start' | 'center' | 'end' | 'space-between'; wrap?: boolean }) {
  return <div className="report-row" style={{ gap, alignItems: align, justifyContent: justify, flexWrap: wrap ? 'wrap' : 'nowrap', ...style }}>{children}</div>;
}
export function Grid({ children, columns, gap = 16, align = 'stretch', style }: BaseProps & { columns: number | string; gap?: number; align?: Align }) {
  return <div className="report-grid" data-columns={typeof columns === 'number' ? columns : undefined} style={{ gridTemplateColumns: typeof columns === 'number' ? `repeat(${columns}, minmax(0, 1fr))` : columns, gap, alignItems: align, ...style }}>{children}</div>;
}
export function Divider({ style }: { style?: CSSProperties }) { return <hr className="report-divider" style={style} />; }

const TypographyContext = createContext(false);
type TextProps = BaseProps & { tone?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'; size?: 'body' | 'small'; as?: 'p' | 'span'; weight?: 'normal' | 'medium' | 'semibold' | 'bold'; italic?: boolean; truncate?: boolean | 'start' | 'end' };
export function Text({ children, tone = 'primary', size = 'body', as, weight = 'normal', italic, truncate, style }: TextProps) {
  const nested = useContext(TypographyContext);
  const Element = as || (nested ? 'span' : 'p');
  const weights = { normal: 400, medium: 500, semibold: 600, bold: 700 };
  return <TypographyContext.Provider value={true}><Element className={`report-text report-text-${tone} report-text-${size}${truncate ? ' report-truncate' : ''}`} style={{ fontWeight: weights[weight], fontStyle: italic ? 'italic' : undefined, direction: truncate === 'start' ? 'rtl' : undefined, ...style }}>{children}</Element></TypographyContext.Provider>;
}
export function H1({ children, style }: BaseProps) { return <TypographyContext.Provider value={true}><h1 style={style}>{children}</h1></TypographyContext.Provider>; }
export function H2({ children, style }: BaseProps) { return <TypographyContext.Provider value={true}><h2 style={style}>{children}</h2></TypographyContext.Provider>; }
export function H3({ children, style }: BaseProps) { return <TypographyContext.Provider value={true}><h3 style={style}>{children}</h3></TypographyContext.Provider>; }

export function Button({ children, variant = 'secondary', disabled, type = 'button', style, onClick }: BaseProps & { variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; type?: 'button' | 'submit' | 'reset'; onClick?: () => void }) {
  return <button className={`report-button report-button-${variant}`} disabled={disabled} type={type} style={style} onClick={onClick}>{children}</button>;
}
export function Pill({ children, active = false, tone: _tone, size = 'md', leadingContent, keyboardHint, disabled, title, style, onClick }: BaseProps & { active?: boolean; tone?: string; size?: 'sm' | 'md'; leadingContent?: ReactNode; keyboardHint?: string; disabled?: boolean; title?: string; onClick?: () => void }) {
  const className = `report-pill report-pill-${size}${active ? ' is-active' : ''}`;
  const content = <>{leadingContent}{children}{keyboardHint && <kbd>{keyboardHint}</kbd>}</>;
  return onClick ? <button className={className} type="button" aria-pressed={active} disabled={disabled} title={title} style={style} onClick={onClick}>{content}</button> : <span className={className} title={title} style={style}>{content}</span>;
}
export function Select({ value, onChange, options, placeholder, disabled, style }: { value?: string; onChange?: (value: string) => void; options: Array<{ value: string; label: string; disabled?: boolean }>; placeholder?: string; disabled?: boolean; style?: CSSProperties }) {
  return <select className="report-select" value={value} onChange={event => onChange?.(event.target.value)} disabled={disabled} aria-label={placeholder || '报告选项'} style={style}>
    {placeholder && <option value="" disabled>{placeholder}</option>}
    {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
  </select>;
}

const CardContext = createContext({ collapsible: false, open: true, toggle: () => {}, bodyId: '', sticky: false });
export function Card({ children, variant = 'default', size = 'base', stickyHeader = false, collapsible = false, defaultOpen = true, open, onOpenChange, style }: BaseProps & { variant?: 'default' | 'borderless'; size?: 'base' | 'lg'; stickyHeader?: boolean; collapsible?: boolean; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const bodyId = useId();
  const toggle = () => { setOpen(!isOpen); onOpenChange?.(!isOpen); };
  return <CardContext.Provider value={{ collapsible, open: isOpen, toggle, bodyId, sticky: stickyHeader }}><section className={`report-card report-card-${variant} report-card-${size}`} style={style}>{children}</section></CardContext.Provider>;
}
export function CardHeader({ children, trailing, style }: BaseProps & { trailing?: ReactNode }) {
  const card = useContext(CardContext);
  const content = <>{card.collapsible && <span aria-hidden="true" className={`report-chevron${card.open ? ' is-open' : ''}`}>›</span>}<span className="report-header-title">{children}</span>{trailing && <span className="report-trailing">{trailing}</span>}</>;
  return card.collapsible ? <button className={`report-card-header report-disclosure${card.sticky ? ' is-sticky' : ''}`} type="button" aria-expanded={card.open} aria-controls={card.bodyId} onClick={card.toggle} style={style}>{content}</button> : <div className={`report-card-header${card.sticky ? ' is-sticky' : ''}`} style={style}>{content}</div>;
}
export function CardBody({ children, style }: BaseProps) {
  const card = useContext(CardContext);
  return <div className="report-card-body" id={card.bodyId} hidden={card.collapsible && !card.open} style={style}>{children}</div>;
}
export function CollapsibleSection({ title, leading, count, trailing, children, defaultOpen = false, style }: BaseProps & { title: string; leading?: ReactNode; count?: number; trailing?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <section className="report-collapsible" style={style}>
    <div className="report-collapsible-heading"><button type="button" className="report-disclosure" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id}><span aria-hidden="true" className={`report-chevron${open ? ' is-open' : ''}`}>›</span>{leading}<span className="report-header-title">{title}</span>{count !== undefined && <span className="report-count">{count}</span>}</button>{trailing && <span className="report-trailing">{trailing}</span>}</div>
    <div id={id} className="report-collapsible-body" hidden={!open}>{children}</div>
  </section>;
}

export function Table({ headers, rows, columnAlign = [], rowTone = [], framed = true, striped = false, stickyHeader = false, style, emptyMessage = '无匹配项' }: { headers: ReactNode[]; rows: ReactNode[][]; columnAlign?: Array<'left' | 'center' | 'right' | undefined>; rowTone?: Array<Tone | undefined>; framed?: boolean; striped?: boolean; stickyHeader?: boolean; style?: CSSProperties; emptyMessage?: ReactNode }) {
  return <div className={`report-table-scroll${framed ? ' report-table-framed' : ''}`} style={style} tabIndex={0} role="region" aria-label="报告数据表，可横向滚动"><table className={`report-table${striped ? ' is-striped' : ''}${stickyHeader ? ' has-sticky-header' : ''}`}><thead><tr>{headers.map((header, i) => <th key={i} scope="col" style={{ textAlign: columnAlign[i] || 'left' }}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{headers.map((_, j) => <td key={j} style={{ textAlign: columnAlign[j] || 'left' }}>{j === 0 && rowTone[i] && <span className={`report-tone-dot report-tone-${rowTone[i]}`} aria-label={rowTone[i]} />}{row[j]}</td>)}</tr>) : <tr><td colSpan={headers.length}>{emptyMessage}</td></tr>}</tbody></table></div>;
}
export function Callout({ children, tone = 'info', title, icon, style }: BaseProps & { tone?: Tone; title?: ReactNode; icon?: ReactNode }) {
  return <aside className={`report-callout report-tone-${tone}`} style={style}>{icon && <span className="report-callout-icon">{icon}</span>}<div>{title && <div className="report-callout-title">{title}</div>}<div>{children}</div></div></aside>;
}
export function Stat({ value, label, tone, style }: { value: ReactNode; label: string; tone?: Tone; style?: CSSProperties }) {
  return <div className="report-stat" style={style}><div className={tone ? `report-stat-value report-tone-${tone}` : 'report-stat-value'}>{value}</div><div className="report-stat-label">{label}</div></div>;
}
export function Link({ children, href, style }: BaseProps & { href: string }) {
  const external = /^https?:\/\//i.test(href);
  const resolved = external || href.startsWith('#') ? href : window.__reportFileUrl(href);
  return <a href={resolved} style={style} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{children}</a>;
}

type Series = { name: string; data: number[]; tone?: Tone };
type ChartProps = { categories: string[]; series: Series[]; height?: number; valueSuffix?: string; valuePrefix?: string; showValues?: boolean; style?: CSSProperties; fill?: boolean };
const chartKeys = new Set(['categories', 'series', 'height', 'valueSuffix', 'valuePrefix', 'showValues', 'style', 'fill']);
function validateChart(props: ChartProps, kind: 'bar' | 'line') {
  for (const key of Object.keys(props)) if (!chartKeys.has(key)) throw new Error(`Unsupported ${kind} chart prop: ${key}`);
  if (props.fill !== undefined && (kind !== 'line' || props.fill !== false)) throw new Error('Area fill is not supported by this report adapter.');
  if (!Array.isArray(props.categories) || !props.categories.length || props.categories.some(value => typeof value !== 'string')) throw new Error('Chart categories must be a non-empty array of strings.');
  if (!Array.isArray(props.series) || !props.series.length) throw new Error('A chart must have at least one series.');
  for (const series of props.series) {
    for (const key of Object.keys(series)) if (!['name', 'data', 'tone'].includes(key)) throw new Error(`Unsupported chart series prop: ${key}`);
    if (typeof series.name !== 'string' || !Array.isArray(series.data) || series.data.length !== props.categories.length || series.data.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Chart data must contain one finite, non-negative value for each category.');
    if (series.tone && !['neutral', 'info', 'success', 'warning', 'danger'].includes(series.tone)) throw new Error(`Unsupported chart tone: ${series.tone}`);
  }
  if (props.height !== undefined && (!Number.isFinite(props.height) || props.height < 160)) throw new Error('Chart height must be at least 160 pixels.');
}
const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
function niceStep(raw: number) {
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  const factor = raw / magnitude;
  return (factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 2.5 ? 2.5 : factor <= 5 ? 5 : 10) * magnitude;
}
function chartColor(series: Series, index: number) { return variable(series.tone === 'neutral' ? 'chart-neutral' : series.tone || (index === 0 ? 'accent' : `chart-${index % 3}`)); }
const chartTextWidth = (text: string) => [...text].reduce((width, character) => width + (/[^\x00-\x7F]/.test(character) ? 12 : 7), 0);
function wrapChartLabel(text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const character of text) {
    if (line && chartTextWidth(line + character) > maxWidth) {
      lines.push(line);
      line = '';
    }
    line += character;
  }
  if (line) lines.push(line);
  return lines.length > 3 ? [...lines.slice(0, 2), `${lines[2].slice(0, -1)}…`] : lines;
}
function Chart(props: ChartProps & { kind: 'bar' | 'line' }) {
  const { kind, ...options } = props;
  validateChart(options, kind);
  const { categories, series, height = 240, valueSuffix = '', valuePrefix = '', style } = options;
  const showValues = options.showValues ?? (kind === 'bar' && series.length === 1 && categories.length <= 8);
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setWidth] = useState(640);
  const [hovered, setHovered] = useState<number | null>(null);
  const id = useId();
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const formatValue = (value: number) => `${valuePrefix}${formatNumber(value)}${valueSuffix}`;
  const maxValue = Math.max(1, ...series.flatMap(entry => entry.data));
  const tickStep = niceStep(maxValue * (showValues ? 1.16 : 1.05) / 4);
  const max = Math.ceil(maxValue * (showValues ? 1.16 : 1.05) / tickStep) * tickStep;
  const tickCount = Math.round(max / tickStep);
  const left = Math.max(54, chartTextWidth(formatValue(max)) + 16);
  const right = 18;
  // The plot always fits its container. Dense categories reduce label frequency,
  // never the data range: every mark and keyboard/hover target remains visible.
  const width = Math.max(240, availableWidth);
  const plotWidth = width - left - right;
  const stride = plotWidth / categories.length;
  const labelWidth = Math.min(96, plotWidth / Math.min(2, categories.length));
  const labelLines = categories.map(category => wrapChartLabel(category, labelWidth));
  const widestLabel = Math.max(...labelLines.flat().map(chartTextWidth));
  const labelEvery = Math.max(1, Math.ceil((widestLabel + 7) / stride));
  const showCategoryLabel = (index: number) => index === 0 || index === categories.length - 1 || (index % labelEvery === 0 && index <= categories.length - 1 - labelEvery);
  const top = 22, bottom = height - 20 - Math.max(...labelLines.map(lines => lines.length)) * 14;
  const y = (value: number) => bottom - value / max * (bottom - top);
  const x = (index: number) => left + stride * (index + 0.5);
  const describeCategory = (index: number) => `${categories[index]} · ${series.map(entry => `${entry.name}：${formatValue(entry.data[index])}`).join('；')}`;
  return <figure className="report-chart" style={style} aria-labelledby={`${id}-title`}>
    <figcaption className="report-chart-legend" id={`${id}-title`}>{series.map((entry, i) => <span key={`${entry.name}-${i}`}><i style={{ backgroundColor: chartColor(entry, i) }} />{entry.name}</span>)}</figcaption>
    <div className="report-chart-scroll" ref={container}>
      <svg className="report-chart-svg" role="img" aria-labelledby={`${id}-svg-title`} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} onMouseLeave={() => setHovered(null)}>
        <title id={`${id}-svg-title`}>{series.map(entry => entry.name).join('、')}，{categories.length} 个分类。可将焦点移到数据列以查看数值。</title>
        {Array.from({ length: tickCount + 1 }, (_, i) => i * tickStep).map(value => <g key={value} className="report-chart-tick"><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text x={left - 9} y={y(value)} dominantBaseline="middle" textAnchor="end">{formatValue(value)}</text></g>)}
        {hovered !== null && <line className="report-chart-guide" x1={x(hovered)} x2={x(hovered)} y1={top} y2={bottom} />}
        {categories.map((category, index) => {
          if (!showCategoryLabel(index)) return null;
          const labelX = categories.length === 1 ? x(index) : index === 0 ? left : index === categories.length - 1 ? width - right : x(index);
          const anchor = categories.length === 1 ? 'middle' : index === 0 ? 'start' : index === categories.length - 1 ? 'end' : 'middle';
          return <text className="report-chart-category" key={index} x={labelX} y={bottom + 20} textAnchor={anchor}><title>{category}</title>{labelLines[index].map((line, lineIndex) => <tspan key={lineIndex} x={labelX} dy={lineIndex === 0 ? 0 : 14}>{line}</tspan>)}</text>;
        })}
        {series.map((entry, s) => <g key={`${entry.name}-${s}`} fill={chartColor(entry, s)}>
          {kind === 'line' && <polyline points={entry.data.map((value, i) => `${x(i)},${y(value)}`).join(' ')} fill="none" stroke={chartColor(entry, s)} strokeWidth={2.5} strokeLinejoin="round" />}
          {entry.data.map((value, i) => {
            const barWidth = Math.min(72, stride * 0.72) / series.length;
            const barX = x(i) - barWidth * series.length / 2 + s * barWidth;
            return <g key={i}>{kind === 'bar' ? <rect x={barX} y={y(value)} width={Math.max(1, barWidth - 1)} height={bottom - y(value)} rx={1}><title>{describeCategory(i)}</title></rect> : <circle cx={x(i)} cy={y(value)} r={3}><title>{describeCategory(i)}</title></circle>}{showValues && <text className="report-chart-value" x={kind === 'bar' ? barX + barWidth / 2 : x(i)} y={y(value) - 8} textAnchor="middle">{formatNumber(value)}</text>}</g>;
          })}
        </g>)}
        {categories.map((category, i) => <rect key={i} className="report-chart-hit" x={left + i * stride} y={top - 10} width={stride} height={bottom - top + 18} fill="transparent" tabIndex={0} role="img" aria-label={describeCategory(i)} onMouseEnter={() => setHovered(i)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)}><title>{describeCategory(i)}</title></rect>)}
      </svg>
    </div>
    <div className="report-chart-tooltip" aria-live="polite">{hovered === null ? '悬停或使用 Tab 查看各项数值' : describeCategory(hovered)}</div>
  </figure>;
}
export function BarChart(props: ChartProps) { return <Chart {...props} kind="bar" />; }
export function LineChart(props: ChartProps) { return <Chart {...props} kind="line" />; }
