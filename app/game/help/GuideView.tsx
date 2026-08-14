"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GuideDocument, GuideSectionId } from "./model";
import {
  createGuideNavigationState,
  navigateGuideBack,
  selectGuideSection,
  toggleGuideEntry,
  type GuideNavigationState,
} from "./navigation";

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
  onExit,
  exitTarget = "/",
}: {
  document: GuideDocument;
  initialSection?: GuideSectionId;
  overlay?: boolean;
  onExit?: () => void;
  exitTarget?: string;
}) {
  const [query, setQuery] = useState("");
  const [exact, setExact] = useState(false);
  const [navigation, setNavigation] = useState<GuideNavigationState>(() =>
    createGuideNavigationState(initialSection),
  );
  const directoryRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const entryButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("zh-CN");
    return needle
      ? document.sections.filter((section) =>
          `${section.title} ${section.summary} ${section.searchText}`
            .toLocaleLowerCase("zh-CN")
            .includes(needle),
        )
      : document.sections;
  }, [document.sections, query]);
  const current =
    document.sections.find((section) => section.id === navigation.sectionId) ??
    visible[0] ??
    document.sections[0];

  const exitGuide = useCallback(() => {
    if (onExit) {
      onExit();
      return;
    }
    window.location.assign(exitTarget);
  }, [exitTarget, onExit]);

  const chooseSection = useCallback((sectionId: GuideSectionId) => {
    const directoryScrollTop = directoryRef.current?.scrollTop ?? 0;
    setNavigation((state) =>
      selectGuideSection(state, sectionId, directoryScrollTop),
    );
    requestAnimationFrame(() => {
      if (contentRef.current) contentRef.current.scrollTop = 0;
      contentRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const chooseEntry = useCallback((entryId: string) => {
    const contentScrollTop = contentRef.current?.scrollTop ?? 0;
    setNavigation((state) =>
      toggleGuideEntry(state, entryId, contentScrollTop),
    );
    requestAnimationFrame(() => {
      const button = entryButtonRefs.current.get(entryId);
      const content = contentRef.current;
      if (!button || !content) return;
      const top = button.offsetTop;
      const bottom = top + button.offsetHeight;
      if (top < content.scrollTop) content.scrollTop = top;
      else if (bottom > content.scrollTop + content.clientHeight) {
        content.scrollTop = Math.max(0, bottom - content.clientHeight);
      }
    });
  }, []);

  const goBack = useCallback(() => {
    const result = navigateGuideBack(navigation);
    if (result.shouldExit) {
      exitGuide();
      return;
    }
    setNavigation(result.state);
    requestAnimationFrame(() => {
      if (result.focusEntryId) {
        if (contentRef.current) {
          contentRef.current.scrollTop = result.state.contentScrollTop;
        }
        entryButtonRefs.current
          .get(result.focusEntryId)
          ?.focus({ preventScroll: true });
        return;
      }
      if (directoryRef.current) {
        directoryRef.current.scrollTop = result.state.directoryScrollTop;
        directoryRef.current.focus({ preventScroll: true });
      }
    });
  }, [exitGuide, navigation]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      goBack();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [goBack]);

  const showTable = current.table &&
    (current.tableDetail !== "exact" || exact);

  return (
    <div
      className={`guide-shell ${overlay ? "guide-overlay" : "guide-standalone"}`}
      data-guide-level={navigation.level}
      role={overlay ? "dialog" : undefined}
      aria-modal={overlay || undefined}
      aria-label="百工手册"
    >
      <header className="guide-toolbar">
        <div className="guide-return-actions">
          <button
            className="guide-return-button"
            data-gamepad-cancel
            onClick={goBack}
            autoFocus
          >
            ← 返回上一级
          </button>
          {onExit ? (
            <button
              className="guide-exit-button"
              data-guide-exit
              onClick={exitGuide}
            >
              返回游戏
            </button>
          ) : (
            <a className="guide-exit-button" data-guide-exit href={exitTarget}>
              返回游戏
            </a>
          )}
        </div>
        <label className="guide-exact-toggle">
          <input
            type="checkbox"
            checked={exact}
            onChange={(event) => setExact(event.target.checked)}
          />
          显示详细数值
        </label>
      </header>

      <div className="guide-layout">
        <aside
          className="guide-nav"
          ref={directoryRef}
          tabIndex={-1}
          aria-label="百工手册目录"
        >
          <div className="guide-brand">
            <p className="kicker">规则随当前测试版更新</p>
            <h1>{document.title}</h1>
            <p>{document.subtitle}</p>
          </div>
          <label className="guide-search">
            查找规则
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="武器、天时、80分钟……"
            />
          </label>
          <nav aria-label="手册目录">
            {visible.map((section) => (
              <button
                key={section.id}
                className={section.id === current?.id ? "active" : ""}
                onClick={() => chooseSection(section.id)}
              >
                <strong>{section.title}</strong>
                <small>{section.summary}</small>
              </button>
            ))}
          </nav>
        </aside>

        <main
          className="guide-content"
          id={`guide-${current.id}`}
          ref={contentRef}
          tabIndex={-1}
        >
          {navigation.level === "directory" ? (
            <section className="guide-directory-overview">
              <p className="kicker">十五章规则总览</p>
              <h2>从目录选一章</h2>
              <p className="guide-summary">
                可按行旅阶段逐章阅读，也可从左侧查找器物、天时或无尽规则。
              </p>
              <div className="guide-directory-cards">
                {visible.map((section) => (
                  <button key={section.id} onClick={() => chooseSection(section.id)}>
                    <strong>{section.title}</strong>
                    <span>{section.summary}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <>
              <p className="kicker">
                百工手册 · {document.sections.findIndex((section) => section.id === current.id) + 1}
              </p>
              <h2>{current.title}</h2>
              <p className="guide-summary">{current.summary}</p>
              {current.diagram && <RuleDiagram kind={current.diagram} />}
              {current.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {exact && current.exactParagraphs?.map((paragraph) => (
                <p className="guide-exact-copy" key={paragraph}>{paragraph}</p>
              ))}
              {current.bullets && <ul>{current.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
              {showTable && (
                <div className="guide-table-wrap">
                  <table>
                    <thead><tr>{current.table?.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                    <tbody>{current.table?.rows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}>{row.map((cell, index) => <td key={`${index}-${cell}`}>{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {current.table?.rows && current.tableDetail === "exact" && !exact && (
                <p className="guide-exact-hint">打开“显示详细数值”可查看精确表格与公式。</p>
              )}
              <div className="guide-entries">
                {current.details?.map((detail, index) => {
                  const entryId = `${current.id}:${index}`;
                  const expanded = navigation.level === "entry" && navigation.entryId === entryId;
                  const panelId = `guide-entry-panel-${current.id}-${index}`;
                  return (
                    <section className={`guide-entry ${expanded ? "open" : ""}`} key={detail.title}>
                      <button
                        className="guide-entry-toggle"
                        ref={(element) => {
                          if (element) entryButtonRefs.current.set(entryId, element);
                          else entryButtonRefs.current.delete(entryId);
                        }}
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        onClick={() => chooseEntry(entryId)}
                      >
                        <span>{detail.title}</span>
                        <b aria-hidden="true">{expanded ? "收起" : "展开"}</b>
                      </button>
                      <div
                        className="guide-entry-panel"
                        id={panelId}
                        role="region"
                        aria-label={detail.title}
                        hidden={!expanded}
                      >
                        {detail.body.map((body) => <p key={body}>{body}</p>)}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
