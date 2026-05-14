import AppKit
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let canvasSize = CGSize(width: 1200, height: 760)
let outputURL = URL(fileURLWithPath: "assets/demo.gif")

struct FrameContent {
  let visibleFindings: Int
  let showBreakdown: Bool
  let delay: Double
}

let frames = [
  FrameContent(visibleFindings: 0, showBreakdown: false, delay: 1.0),
  FrameContent(visibleFindings: 1, showBreakdown: false, delay: 1.2),
  FrameContent(visibleFindings: 3, showBreakdown: false, delay: 1.4),
  FrameContent(visibleFindings: 4, showBreakdown: true, delay: 2.4),
]

let findings = [
  "Description promises a full auth refactor, but the diff only adds a tiny logging helper.",
  "The new test is a stub: expect(true).toBe(true) never exercises the claimed behavior.",
  "Generic language like robust, comprehensive, and maintainability is not backed by code.",
  "README text admits this is a mismatched PR description for the demo scenario.",
]

let dimensions: [(String, String)] = [
  ("AI-generation likelihood", "45"),
  ("Description-diff mismatch", "75"),
  ("Test hollowness", "70"),
  ("Architectural fit", "25"),
  ("Author signal", "10"),
  ("Commit quality", "45"),
]

func color(_ hex: UInt32) -> NSColor {
  NSColor(
    calibratedRed: CGFloat((hex >> 16) & 0xff) / 255.0,
    green: CGFloat((hex >> 8) & 0xff) / 255.0,
    blue: CGFloat(hex & 0xff) / 255.0,
    alpha: 1
  )
}

func rect(_ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat) -> CGRect {
  CGRect(x: x, y: canvasSize.height - y - height, width: width, height: height)
}

func drawRounded(_ r: CGRect, radius: CGFloat, fill: NSColor, stroke: NSColor? = nil, width: CGFloat = 1) {
  let path = NSBezierPath(roundedRect: r, xRadius: radius, yRadius: radius)
  fill.setFill()
  path.fill()
  if let stroke {
    stroke.setStroke()
    path.lineWidth = width
    path.stroke()
  }
}

func drawText(
  _ text: String,
  x: CGFloat,
  y: CGFloat,
  width: CGFloat,
  height: CGFloat,
  size: CGFloat,
  weight: NSFont.Weight = .regular,
  color textColor: NSColor = color(0x24292f),
  lineHeight: CGFloat? = nil
) {
  let paragraph = NSMutableParagraphStyle()
  paragraph.lineBreakMode = .byWordWrapping
  paragraph.lineSpacing = lineHeight.map { max(0, $0 - size) } ?? 4

  let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: size, weight: weight),
    .foregroundColor: textColor,
    .paragraphStyle: paragraph,
  ]

  NSString(string: text).draw(with: rect(x, y, width, height), options: [.usesLineFragmentOrigin], attributes: attributes)
}

func drawPill(_ text: String, x: CGFloat, y: CGFloat, width: CGFloat, fill: NSColor, textColor: NSColor) {
  drawRounded(rect(x, y, width, 32), radius: 16, fill: fill)
  drawText(text, x: x + 16, y: y + 7, width: width - 32, height: 20, size: 14, weight: .semibold, color: textColor)
}

func makeFrame(_ content: FrameContent) -> CGImage {
  let image = NSImage(size: canvasSize)
  image.lockFocus()

  color(0xf6f8fa).setFill()
  NSRect(origin: .zero, size: canvasSize).fill()

  drawText("littleKitchen / pr-bouncer-demo-target", x: 72, y: 38, width: 520, height: 30, size: 18, weight: .medium, color: color(0x57606a))
  drawText("Refactor authentication module and add complete tests", x: 72, y: 82, width: 760, height: 40, size: 28, weight: .semibold)
  drawPill("Open", x: 852, y: 84, width: 76, fill: color(0x1f883d), textColor: .white)
  drawPill("+10", x: 948, y: 84, width: 64, fill: color(0xd1f8d9), textColor: color(0x1a7f37))
  drawPill("-0", x: 1026, y: 84, width: 58, fill: color(0xffebe9), textColor: color(0xcf222e))

  drawRounded(rect(72, 152, 1056, 102), radius: 8, fill: .white, stroke: color(0xd0d7de))
  drawText("Pull request description", x: 104, y: 178, width: 360, height: 24, size: 16, weight: .semibold)
  drawText("This comprehensively refactors the authentication module for better security, performance, and maintainability. It also adds full test coverage for all authentication edge cases.", x: 104, y: 210, width: 880, height: 42, size: 16, color: color(0x57606a))

  drawRounded(rect(72, 290, 1056, 398), radius: 8, fill: .white, stroke: color(0xd0d7de))
  drawText("pr-bouncer[bot]", x: 112, y: 316, width: 180, height: 24, size: 16, weight: .semibold)
  drawText("commented on May 14, 2026", x: 248, y: 318, width: 260, height: 22, size: 14, color: color(0x57606a))

  drawRounded(rect(104, 360, 256, 74), radius: 8, fill: color(0xfff8c5), stroke: color(0xd4a72c))
  drawText("Slop probability", x: 128, y: 375, width: 180, height: 22, size: 15, weight: .medium, color: color(0x6e4700))
  drawText("51/100", x: 128, y: 398, width: 170, height: 34, size: 30, weight: .bold, color: color(0x9a6700))

  drawText("pr-bouncer report", x: 392, y: 364, width: 420, height: 28, size: 24, weight: .semibold)
  drawText("Automated triage signal from the existing demo PR", x: 392, y: 398, width: 520, height: 24, size: 16, color: color(0x57606a))

  var nextY: CGFloat = 462
  for finding in findings.prefix(content.visibleFindings) {
    drawText("•", x: 112, y: nextY, width: 18, height: 22, size: 18, color: color(0x57606a))
    drawText(finding, x: 138, y: nextY, width: 620, height: 44, size: 15, color: color(0x24292f), lineHeight: 20)
    nextY += 50
  }

  if content.showBreakdown {
    drawRounded(rect(790, 452, 292, 184), radius: 8, fill: color(0xf6f8fa), stroke: color(0xd0d7de))
    drawText("Dimension breakdown", x: 812, y: 472, width: 220, height: 24, size: 16, weight: .semibold)
    var rowY: CGFloat = 506
    for (name, score) in dimensions {
      drawText(name, x: 812, y: rowY, width: 210, height: 18, size: 13, color: color(0x57606a))
      drawText(score, x: 1030, y: rowY, width: 36, height: 18, size: 13, weight: .semibold, color: color(0x24292f))
      rowY += 20
    }
  }

  drawText("This is an automated triage signal, not a verdict. Use your judgment.", x: 104, y: 650, width: 660, height: 22, size: 14, color: color(0x57606a))

  image.unlockFocus()
  var proposed = CGRect(origin: .zero, size: canvasSize)
  return image.cgImage(forProposedRect: &proposed, context: nil, hints: nil)!
}

guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.gif.identifier as CFString, frames.count, nil) else {
  fatalError("Could not create GIF destination")
}

CGImageDestinationSetProperties(destination, [
  kCGImagePropertyGIFDictionary as String: [
    kCGImagePropertyGIFLoopCount as String: 0,
  ],
] as CFDictionary)

for frame in frames {
  CGImageDestinationAddImage(destination, makeFrame(frame), [
    kCGImagePropertyGIFDictionary as String: [
      kCGImagePropertyGIFDelayTime as String: frame.delay,
    ],
  ] as CFDictionary)
}

if !CGImageDestinationFinalize(destination) {
  fatalError("Could not write assets/demo.gif")
}

print("Wrote \(outputURL.path)")
