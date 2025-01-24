import * as dl from 'docling';

export default function TableItem({ item }: { item: dl.TableItem }) {
  const coveredCells = new Set<string>();

  return (
    <div className="brd-table-container">
      <table className="brd-table">
        <tbody>
          {item.data.grid.map(row => (
            <tr>
              {row.map(cell => {
                // Ignore cell that has already been covered by a previous multi-span cell.
                if (
                  !coveredCells.has(
                    [
                      cell.start_col_offset_idx,
                      cell.start_row_offset_idx,
                    ].join()
                  )
                ) {
                  // Mark covered grid cells.
                  for (
                    let x = cell.start_col_offset_idx;
                    x < cell.end_col_offset_idx;
                    x++
                  ) {
                    for (
                      let y = cell.start_row_offset_idx;
                      y < cell.end_row_offset_idx;
                      y++
                    ) {
                      coveredCells.add([x, y].join());
                    }
                  }

                  const id =
                    `${item.self_ref}/${cell.start_col_offset_idx}/${cell.start_row_offset_idx}`.slice(
                      1
                    );

                  return (
                    <td
                      id={id}
                      className={
                        cell.column_header || cell.row_header
                          ? 'brd-table-header'
                          : ''
                      }
                      title={JSON.stringify(cell, null, 2)}
                      colSpan={cell.col_span}
                      rowSpan={cell.row_span}
                    >
                      <a href={`#${id}`}>{cell.text}</a>
                    </td>
                  );
                } else {
                  return null;
                }
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
