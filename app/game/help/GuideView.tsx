"use client";

import { useMemo, useState } from "react";
import type { GuideDocument, GuideSectionId } from "./model";

function RuleDiagram({ kind }: { kind: "upgrade" | "fold" | "weave" | "curve" }) {
  if (kind === "upgrade") {
    return <div className="guide-diagram upgrade" aria-label="五阶成长"><span>拿到</span><i /><span>做细</span><i /><span>改法</span><i /><span>再磨</span><i /><span>定型</span></div>;
  }
  if (kind === "fold") {
    return <div className="guide-diagram fold" aria-label="折叠时间线"><span>持续移动 0.55秒</span><i /><span>折叠 0.30秒</span><i /><span>纸飞机</span><b>停步 0.10秒 → 展开 0.24秒</b></div>;
  }
  if (kind === "weave") {
    return <div className="guide-diagram weave" aria-label="器盘顺时针游标"><span>①</span><span>②</span><span>③</span><span>④</span><b>顺时针经过节点<br />完整一圈后收势</b></div>;
  }
  return <div className="guide-diagram curve" aria-label="无尽高级怪概率曲线"><span style={{ height: "6%" }}>0</span><span style={{ height: "18%" }}>15</span><span style={{ height: "57%" }}>35</span><span style={{ height: "69%" }}>45</span><span style={{ height: "84%" }}>60</span><span style={{ height: "98%" }}>80</span></div>;
}

export function GuideView({
  document,
  initialSection = "start",
  overlay = false,
  onClose,
}: {
  document: GuideDocument;
  initialSection?: GuideSectionId;
  overlay?: boolean;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<GuideSectionId>(initialSection);
  const [exact, setExact] = useState(false);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return needle
      ? document.sections.filter((section) => `${section.title} ${section.summary} ${section.searchText}`.toLocaleLowerCase("zh-CN").includes(needle))
      : document.sections;
  }, [document.sections, query]);
  const current = document.sections.find((section) => section.id === active) ?? visible[0] ?? document.sections[0];

  return (
    <div className={`guide-shell ${overlay ? "overlay" : "page"}`} role={overlay ? "dialog" : undefined} aria-modal={overlay || undefined} aria-label="百工手册">
      <header className="guide-header">
        <div><p className="kicker">规则随当前测试版更新</p><h1>{document.title}</h1><p>{document.subtitle}</p></div>
        <div className="guide-head-actions">
          <label><input type="checkbox" checked={exact} onChange={(event) => setExact(event.target.checked)} /> 显示详细数值</label>
          {onClose && <button onClick={onClose} autoFocus>合上手册</button>}
        </div>
      </header>
      <div className="guide-layout">
        <aside className="guide-nav">
          <label className="guide-search">查找规则<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="武器、天时、80分钟……" /></label>
          <nav aria-label="手册目录">
            {visible.map((section) => <button key={section.id} className={section.id === current?.id ? "active" : ""} onClick={() => setActive(section.id)}>{section.title}</button>)}
          </nav>
        </aside>
        <main className="guide-content" id={`guide-${current.id}`} tabIndex={-1}>
          <p className="kicker">百工手册 · {document.sections.findIndex((section) => section.id === current.id) + 1}</p>
          <h2>{current.title}</h2>
          <p className="guide-summary">{current.summary}</p>
          {current.diagram && <RuleDiagram kind={current.diagram} />}
          {current.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {current.bullets && <ul>{current.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
          {current.table && <div className="guide-table-wrap"><table><thead><tr>{current.table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{current.table.rows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}>{row.map((cell, index) => <td key={`${index}-${cell}`}>{cell}</td>)}</tr>)}</tbody></table></div>}
          {current.details?.map((detail) => <details key={detail.title} open={exact || undefined}><summary>{detail.title}</summary>{detail.body.map((body) => <p key={body}>{body}</p>)}</details>)}
        </main>
      </div>
    </div>
  );
}
