/**
 * electricEdge.ts
 * 電流エッジ描画ユーティリティ（えにし フォーカス時演出）
 *
 * 設計：§改修設計 電流エッジ + ズームイン演出
 * - 3レイヤー重ねで「バチバチ」感を演出
 * - 毎フレーム異なるジグザグを生成 → アニメーションに見える
 * - react-force-graph-2d の linkCanvasObject（afterモード）で使用
 */

// ─── 内部ヘルパー ────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * ランダムなジグザグパスを描画する（毎フレーム異なる値 → ビリビリ感）
 */
function drawLightningPath(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  segments: number,
  displacement: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  // 法線ベクトル（エッジに対して垂直方向にジッターを加える）
  const nx = -dy / len;
  const ny = dx / len;

  const points: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const jitter = (Math.random() - 0.5) * 2 * displacement;
    points.push({
      x: x1 + dx * t + jitter * nx,
      y: y1 + dy * t + jitter * ny,
    });
  }
  points.push({ x: x2, y: y2 });

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
}

// ─── 公開 API ────────────────────────────────────────────────────────────────

/**
 * 電流エッジを描画する
 *
 * @param ctx   - Canvas 2D コンテキスト（react-force-graph-2d のグラフ座標空間）
 * @param x1    - 始点 X（グラフ座標）
 * @param y1    - 始点 Y
 * @param x2    - 終点 X
 * @param y2    - 終点 Y
 * @param color - ベースカラー（HEX: "#rrggbb"）
 * @param weight - 縁の強さ（1〜5）
 */
export function drawElectricEdge(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  weight: number,
): void {
  const segs = 6 + Math.floor(weight * 1.5);  // セグメント数（太い縁ほど複雑に）
  const disp = 7 + weight * 2.0;              // ジッター量（px in graph coords）
  const baseAlpha = 0.65 + Math.random() * 0.35;

  // Layer 1: 外側グロー（太・暗め・発光感）
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.strokeStyle = hexToRgba(color, 0.25);
  ctx.lineWidth = 2.0 + weight * 0.5;
  ctx.globalAlpha = baseAlpha * 0.45;
  drawLightningPath(ctx, x1, y1, x2, y2, segs, disp);
  ctx.stroke();
  ctx.restore();

  // Layer 2: 中間閃光（中・鮮やか）
  ctx.save();
  ctx.shadowBlur = 4;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.0 + weight * 0.25;
  ctx.globalAlpha = baseAlpha * 0.82;
  drawLightningPath(ctx, x1, y1, x2, y2, segs, disp * 0.5);
  ctx.stroke();
  ctx.restore();

  // Layer 3: コア（細・ほぼ白）
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = baseAlpha * 0.88;
  drawLightningPath(ctx, x1, y1, x2, y2, segs, disp * 0.18);
  ctx.stroke();
  ctx.restore();
}
