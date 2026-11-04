# Serial communications and register bindings — Builder 0.8.0

Open **Communications** to configure the app in the fixed right Inspector.
Existing projects default to **None** and open no new UART.

| App mode | Behavior |
| --- | --- |
| None | Bindings stay saved but inactive. |
| Modbus master (RTU) | Polls one remote station and queues control writes. |
| Modbus slave (RTU) | Serves the app's mapped local register bank. |
| UART master | Same register behavior, with RTU, JSON Lines or custom encoding. |
| UART slave | Same local bank, with the selected UART encoding. |

Set UART number, TX/RX GPIO, baud, data bits, parity, stop bits and station ID.
For an RS-485 transceiver, set DE GPIO and active level, or use −1 for hardware
that controls direction automatically / a plain UART connection. Station ID is
the remote station in master mode and this app's own station in slave mode.
Only one serial connection is configured per app in this version.

In slave mode, **Holding-register bank size** reserves addresses 0 through
size−1 (up to 1024 registers); zero keeps only addresses declared by bindings.
**FC04 mirrors holding registers** lets an existing controller read that same
bank with FC04. Its default is off, preserving separate input-register tables.
Full-bank addresses are available even without a visible bound element.

Advanced application setup can assign `_td_link.on_write(table, address,
words)` and `_td_link.before_read(table, address, count)`. The write hook runs
after a validated commit, including broadcast writes. The read hook runs
before a validated read reply, allowing clock or acknowledgment registers.
Hooks run on the application loop and must return promptly. They can update
`_td_link.bank[(table,address)]`; register words remain unsigned 0–65535.

GPIO/UART availability depends on the board. Hardware access requires root.
The app uses `machine.UART` and does not change TinyDesk's console or reserved
RS-485 settings. A rejected/reserved port produces `ERROR` while the UI stays
open. Do not configure a second controller on a UART already used by your app.

Choose an unbound text element as **Connection status element**. It shows
WAIT, LISTENING, ONLINE, TIMEOUT, STALE, WRITE ERROR or ERROR. Advanced handlers
can inspect `_td_link.state` and `_td_link.last_error` for details.
For diagnostics, `rx_bytes` and `tx_bytes` count transferred bytes, `frames`
counts accepted transactions and `errors` counts parser/receive failures.
Zero accepted frames alone does not establish that no electrical input arrived;
check the raw byte counter and last error too.

## Bind an element without writing a callback

1. Select a label, text field, picture label, button, checkbox, progress bar,
   slider, gauge or meter. Canvas drawing elements need a name; Builder creates
   one when enabling the binding.
2. Enable **Register binding**. Select read, write or read-and-write as
   appropriate for the control.
3. Choose table and **zero-based wire address**. For example, a PLC's first
   holding register labelled 40001 usually means table Holding / address 0;
   check its register map. Builder does not automatically subtract 40001.
4. Choose unsigned/signed 16-bit, unsigned/signed 32-bit or float32. A 32-bit
   value occupies two registers. Word order selects ABCD or CDAB; bytes inside
   each register stay big-endian. Bit tables use unsigned 16-bit values 0/1.
5. Set scale, offset, decimal places, prefix/suffix and writable limits.
   Displayed value = raw value × multiplier + offset. Writes invert that
   calculation and validate both the configured limits and the raw type.
6. For controls, choose an event and write action. Buttons support constants
   and toggles; canvas buttons also support press/release and paired momentary
   writes. Checkboxes/sliders use Change; textboxes use Enter. Existing Python
   callbacks are preserved and run before the generated binding action.

In master mode, reads update displays. Write-only addresses are also polled
for readback/connection verification. A write is blocked until a valid reply
has arrived, and again after the stale interval. Use addresses that support
readback. In slave mode, remote writes update the displayed bank; local
controls update the same bank for the remote master to read. Holding registers
and coils are writable. Input registers and discrete inputs are read-only on
the wire. Remote writes to mapped writable controls honor their limits.

Read failures keep the last numeric gauge position; stale text displays `--`.
Use the connection status element so numeric values have visible quality.
One successful reply establishes station-level freshness; this is not a
separate quality flag for every individual register.

## Simulation and a ready-made example

Import [register_panel.json](../examples/register_panel.json) and choose
**Run simulation**. Serial bindings use an isolated local bank; no MCU UART
is opened. **Set 30 C**, Output and the slider update the bank and associated
displays. Edit **Initial / simulated value** to preview another starting value.
These initial values also initialize a slave's bank. Master hardware displays
wait for real replies rather than treating initial values as live readings.

The browser runs the generated MicroPython source and real tdui events. It does
not emulate electrical noise, RS-485 direction timing, device delays or GPIO
reservations. Validate wiring/timing/register semantics on your target device
before using a new communication configuration with a machine.

## UART custom protocol

UART modes default to **Modbus RTU register frames**, as requested: the same
tables, addresses and function meanings as Modbus mode. **JSON Lines registers**
is also available. For example:

```json
{"id":1,"unit":1,"op":"read","table":"hr","address":0,"count":1,"values":[]}
{"id":1,"unit":1,"values":[250]}
{"id":2,"unit":1,"op":"write","table":"hr","address":0,"count":1,"values":[300]}
{"id":2,"unit":1,"ok":true}
```

Each line ends in LF. Replies echo `id` and `unit`; failures use an integer
`error` field. Values are raw unsigned register words / bits, before scaling.

For a device-specific wire format, choose **Custom Python codec**, enter its
module name and choose newline or serial-idle framing. Download the template:

```python
import json

def encode(message):
    return json.dumps(message).encode()

def decode(frame):
    return json.loads(frame)
```

Replace these functions with the device's binary/text framing and checksum
logic. They translate the same register-message dictionaries shown above.
`encode` returns bytes without the terminal LF; Builder adds it in newline
mode. `decode` receives a complete frame without that LF. Idle mode adds no
delimiter. A codec may return a false/empty message for irrelevant frames.
It must not block, sleep or run its own receive loop.

The codec is declared as an application module. Supply `my_codec.py` via the
helper's `--project-dir PATH` for compilation, or import a matching compiled
`my_codec.mpy` dependency. Export app bundles it inside the TDAPP. The isolated
bank simulator does not load a hardware-only codec unless your own handlers
also reference it. Automatically added codec declarations are removed when
switching away from that codec; user-supplied modules are preserved.

## Runtime limits and persistence

- RTU functions 01–06, 15 and 16; one station and one outstanding master request.
  Slave reads support up to 125 registers and FC16 writes up to 123 registers
  within the mapped bank. RTU frame lengths tolerate split UART FIFO reads;
  partial frames expire and invalid CRC data is resynchronized with bounded work.
  CRC, station, function, lengths, address range and acknowledgments are checked.
- At most 128 bound elements, 16 queued writes and 512 received/frame bytes.
  Slave writes validate before committing; invalid requests cannot partly
  overwrite the bank. Slider writes coalesce. Momentary edges stay ordered.
- Read retries are configurable. Writes are not retried automatically because
  an acknowledgment can be lost after a command already took effect.
- Reads and reply timeouts use short timer steps rather than sleeping in an
  event handler. Actual UART transmission time still depends on baud/frame
  length; DE transmission waits for the frame to leave the UART. Tune polling
  for the number of bindings. Each poll interval starts one register request.
- Unchanged readings do not redraw their elements. Hidden named canvas fields
  update their retained page through the existing tdui API.
- Exported `.py`, `.mpy` and `.tdapp` contain the communication runtime used to
  build them. `communication.version = 1` records this contract in the editable
  project; later Builder updates do not replace an installed app's runtime.
  None adds no serial runtime to generated code. TDAPP remains one file with
  JSON, code, assets and any custom codec dependency.

The RTU implementation follows the framing and CRC rules in the
[Modbus serial-line specification](https://www.modbus.org/docs/Modbus_over_serial_line_V1_02.pdf).
