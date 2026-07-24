import ApplicationServices
import CoreGraphics
import Darwin
import Foundation

private func eventMask(_ eventType: CGEventType) -> CGEventMask {
    CGEventMask(1) << CGEventMask(eventType.rawValue)
}

private let leftCommandKeyCode: Int64 = 0x37
private let rightCommandKeyCode: Int64 = 0x36
private let functionKeyCode: Int64 = 0x3F
private let leftCommandFlagMask: CGEventFlags.RawValue = 0x00000008
private let rightCommandFlagMask: CGEventFlags.RawValue = 0x00000010

private final class FunctionKeyMonitor {
    static let shared = FunctionKeyMonitor()

    private var eventTap: CFMachPort?
    private var isFunctionKeyDown = false
    private var isLeftCommandDown = false
    private var isRightCommandDown = false
    private var areBothCommandKeysDown = false

    private static let callback: CGEventTapCallBack = { _, type, event, _ in
        switch type {
        case .tapDisabledByTimeout, .tapDisabledByUserInput:
            FunctionKeyMonitor.shared.resetModifierState()
            if let eventTap = FunctionKeyMonitor.shared.eventTap {
                CGEvent.tapEnable(tap: eventTap, enable: true)
            }
        case .flagsChanged, .keyDown, .keyUp:
            FunctionKeyMonitor.shared.handle(type: type, event: event)
        default:
            break
        }

        return Unmanaged.passUnretained(event)
    }

    func start() -> Int32 {
        let promptKey = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
        let options = [promptKey: true] as CFDictionary

        guard AXIsProcessTrustedWithOptions(options) else {
            print("accessibility-permission-missing")
            fflush(stdout)
            return 2
        }

        let mask =
            eventMask(.flagsChanged) |
            eventMask(.keyDown) |
            eventMask(.keyUp) |
            eventMask(.tapDisabledByTimeout) |
            eventMask(.tapDisabledByUserInput)

        guard let eventTap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .listenOnly,
            eventsOfInterest: mask,
            callback: Self.callback,
            userInfo: nil
        ) else {
            print("event-tap-create-failed")
            fflush(stdout)
            return 3
        }

        self.eventTap = eventTap

        guard let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0) else {
            print("run-loop-source-create-failed")
            fflush(stdout)
            return 4
        }

        CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
        CGEvent.tapEnable(tap: eventTap, enable: true)

        print("function-key-monitor-ready")
        fflush(stdout)

        CFRunLoopRun()
        return 0
    }

    private func handle(type: CGEventType, event: CGEvent) {
        handleFunctionKey(type: type, event: event)
        handleCommandKeys(type: type, event: event)
    }

    private func handleFunctionKey(type: CGEventType, event: CGEvent) {
        guard type == .flagsChanged else {
            return
        }

        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        guard keyCode == functionKeyCode else {
            return
        }

        let nextIsFunctionKeyDown = event.flags.contains(.maskSecondaryFn)

        guard nextIsFunctionKeyDown != isFunctionKeyDown else {
            return
        }

        isFunctionKeyDown = nextIsFunctionKeyDown

        if nextIsFunctionKeyDown {
            print("function-key-down")
        } else {
            print("function-key-up")
        }

        fflush(stdout)
    }

    private func handleCommandKeys(type: CGEventType, event: CGEvent) {
        guard type == .flagsChanged else {
            return
        }

        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        guard keyCode == leftCommandKeyCode || keyCode == rightCommandKeyCode else {
            return
        }

        updateCommandState(flags: event.flags)
    }

    private func updateCommandState(flags: CGEventFlags) {
        isLeftCommandDown = flags.rawValue & leftCommandFlagMask != 0
        isRightCommandDown = flags.rawValue & rightCommandFlagMask != 0

        let nextAreBothCommandKeysDown = isLeftCommandDown && isRightCommandDown

        guard nextAreBothCommandKeysDown != areBothCommandKeysDown else {
            return
        }

        areBothCommandKeysDown = nextAreBothCommandKeysDown

        if nextAreBothCommandKeysDown {
            print("command-both-down")
        } else {
            print("command-both-up")
        }

        fflush(stdout)
    }

    private func resetModifierState() {
        isFunctionKeyDown = false
        isLeftCommandDown = false
        isRightCommandDown = false
        areBothCommandKeysDown = false
    }
}

exit(FunctionKeyMonitor.shared.start())
