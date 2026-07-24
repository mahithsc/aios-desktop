import ApplicationServices
import CoreGraphics
import Darwin
import Foundation

private let commandKeyCode: CGKeyCode = 0x37
private let vKeyCode: CGKeyCode = 0x09

private func postKeyEvent(keyCode: CGKeyCode, isKeyDown: Bool, flags: CGEventFlags = []) {
    guard let event = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: isKeyDown) else {
        print("paste-command-event-create-failed")
        fflush(stdout)
        exit(3)
    }

    event.flags = flags
    event.post(tap: .cghidEventTap)
}

let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
let options = [promptKey: true] as CFDictionary

guard AXIsProcessTrustedWithOptions(options) else {
    print("accessibility-permission-missing")
    fflush(stdout)
    exit(2)
}

postKeyEvent(keyCode: commandKeyCode, isKeyDown: true, flags: .maskCommand)
postKeyEvent(keyCode: vKeyCode, isKeyDown: true, flags: .maskCommand)
postKeyEvent(keyCode: vKeyCode, isKeyDown: false, flags: .maskCommand)
postKeyEvent(keyCode: commandKeyCode, isKeyDown: false)

print("paste-command-sent")
fflush(stdout)
