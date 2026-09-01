import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { AutoSizer, CellMeasurer, CellMeasurerCache, List, type ListRowProps } from "react-virtualized";

/** Sections with more rows than this scroll on their own and only draw the rows in view. */
const VIRTUALIZE_ABOVE_ROW_COUNT = 50;

/** Props for CompatVirtualRows. */
interface CompatVirtualRowsProps {
  /** How many rows the section has. Row heights are measured again when it changes. */
  rowCount: number;
  /** Builds the row at `index`. Only called for rows being drawn. */
  renderRow: (index: number) => React.ReactNode;
  /** Classes for the rows' container, such as the text size. */
  className?: string;
  /** Classes for each row's wrapper, such as the space below it. */
  rowClassName?: string;
}

/**
 * The rows of an open compat section. A small section renders every row, and a large one becomes a fixed-height list
 * that only draws the rows in view.
 * @param props - The component props.
 * @returns The section's rows.
 */
const CompatVirtualRows = ({ rowCount, renderRow, className, rowClassName }: CompatVirtualRowsProps) => {
  const listRef = useRef<List | null>(null);
  const listWidthRef = useRef(0);
  const rowHeightCache = useMemo(
    () => new CellMeasurerCache({ fixedWidth: true, defaultHeight: 120, minHeight: 20 }),
    [],
  );
  const resetRowHeights = useCallback(() => {
    rowHeightCache.clearAll();
    listRef.current?.recomputeRowHeights();
  }, [rowHeightCache]);

  useEffect(resetRowHeights, [resetRowHeights, rowCount]);

  if (rowCount <= VIRTUALIZE_ABOVE_ROW_COUNT) {
    return (
      <div className={className}>
        {Array.from({ length: rowCount }, (_, index) => (
          <div key={index} className={rowClassName}>
            {renderRow(index)}
          </div>
        ))}
      </div>
    );
  }

  const renderListRow = ({ index, key, parent, style }: ListRowProps) => (
    <CellMeasurer cache={rowHeightCache} columnIndex={0} index={index} key={key} parent={parent}>
      {({ registerChild }) => (
        <div ref={registerChild} style={{ ...style, width: "100%" }} className={rowClassName}>
          {renderRow(index)}
        </div>
      )}
    </CellMeasurer>
  );

  return (
    <div className={`h-[70vh] ${className ?? ""}`}>
      <AutoSizer
        onResize={({ width }) => {
          if (listWidthRef.current === width) return;
          listWidthRef.current = width;
          resetRowHeights();
        }}
      >
        {({ height, width }) => (
          <List
            ref={listRef}
            className="scrollbar scrollbar-track-gray-700 scrollbar-thumb-blue-700"
            width={width}
            height={height}
            rowCount={rowCount}
            rowHeight={rowHeightCache.rowHeight}
            rowRenderer={renderListRow}
            estimatedRowSize={120}
            overscanRowCount={12}
            deferredMeasurementCache={rowHeightCache}
          />
        )}
      </AutoSizer>
    </div>
  );
};

export default CompatVirtualRows;
