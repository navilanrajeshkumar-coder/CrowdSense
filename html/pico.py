import sys
import select
import time
from machine import Pin, PWM, ADC, I2C
import dht
from bmp280 import BMP280

# --- 1. SERVOS (GP14 = Main Gate, GP15 = Emergency Exit Gate) ---
servo_main = PWM(Pin(14))
servo_exit = PWM(Pin(15))
servo_main.freq(50)
servo_exit.freq(50)

def set_servo(servo, angle):
    duty = int(1638 + (angle / 180) * 6553)
    servo.duty_u16(duty)

set_servo(servo_main, 90)  # Main gate OPEN
set_servo(servo_exit, 0)   # Emergency exit CLOSED

# --- 2. BUZZER (GP19) ---
buzzer = Pin(19, Pin.OUT)
buzzer.value(0)

def beep(times=1, duration=0.1):
    for _ in range(times):
        buzzer.value(1)
        time.sleep(duration)
        buzzer.value(0)
        time.sleep(0.08)

# --- 3. SENSORS (MQ-2, DHT11, BMP280, 2x Flame) ---
mq2_adc = ADC(Pin(26))
dht_sensor = dht.DHT11(Pin(16))
flame_food = Pin(17, Pin.IN, Pin.PULL_UP)
flame_cinema = Pin(18, Pin.IN, Pin.PULL_UP)

i2c = I2C(0, sda=Pin(0), scl=Pin(1), freq=100000)
try:
    bmp = BMP280(i2c)
except Exception:
    bmp = None

main_gate_state = "OPEN"
exit_gate_state = "CLOSED"
last_send = time.ticks_ms()

beep(2, 0.08)  # Startup chime

while True:
    # A. Listen for commands from Chrome CrowdSense Dashboard
    if select.select([sys.stdin], [], [], 0)[0]:
        cmd = sys.stdin.readline().strip()
        if cmd == "CLOSE":
            set_servo(servo_main, 0)
            main_gate_state = "CLOSED"
            beep(2, 0.1)
        elif cmd == "OPEN":
            set_servo(servo_main, 90)
            main_gate_state = "OPEN"
            set_servo(servo_exit, 0)
            exit_gate_state = "CLOSED"
        elif cmd == "EVAC":
            set_servo(servo_main, 90)
            set_servo(servo_exit, 90)
            main_gate_state = "OPEN"
            exit_gate_state = "OPEN"
            beep(4, 0.15)

    # B. Instant Flame Sensor Check
    f1 = 1 if flame_food.value() == 0 else 0
    f2 = 1 if flame_cinema.value() == 0 else 0
    if f1 or f2:
        set_servo(servo_main, 90)
        set_servo(servo_exit, 90)
        main_gate_state = "OPEN"
        exit_gate_state = "OPEN"
        buzzer.value(1)
    else:
        buzzer.value(0)

    # C. Read Sensors & Send to Chrome every 2s
    if time.ticks_diff(time.ticks_ms(), last_send) > 2000:
        last_send = time.ticks_ms()

        try:
            dht_sensor.measure()
            hum = dht_sensor.humidity()
            temp = dht_sensor.temperature()
        except Exception:
            hum, temp = 0, 0

        if bmp:
            try:
                temp = round(bmp.temperature, 1)
                pressure = round(bmp.pressure / 100, 1)
            except Exception:
                pressure = 1013.2
        else:
            pressure = 1013.2

        gas_ppm = int(100 + (mq2_adc.read_u16() / 65535) * 900)

        if gas_ppm > 550:
            set_servo(servo_main, 90)
            set_servo(servo_exit, 90)
            main_gate_state = "OPEN"
            exit_gate_state = "OPEN"
            beep(3, 0.15)

        print(f"DATA:{gas_ppm},{hum},{temp},{pressure},{f1},{f2},{main_gate_state},{exit_gate_state}")