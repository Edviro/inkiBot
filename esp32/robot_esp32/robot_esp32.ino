#include <WiFi.h>
#include <WebServer.h>

// ======================================================
// ROBOT ESP32 IoT  -  v3 (por USB hacia la Lenovo)
//
// La ESP32 ya NO habla MQTT. Va conectada por cable USB a la
// Lenovo, y el programa puente.py de la Lenovo es quien
// se conecta al broker en la nube.
//
//   ESP32 --USB--> Lenovo (puente.py) --internet--> Broker nube
//
// Protocolo por el cable (115200 baudios, una linea por mensaje):
//
//  ESP32 -> Lenovo   (cada 500 ms)
//    {"del":23.45,"tra":-1,"pir":1,"luz":0,"modo":"AUTO","motor":"parar"}
//    {"evento":"FRENO_OBSTACULO_DELANTE"}
//    # texto        <- lineas con # son solo informativas
//
//  Lenovo -> ESP32
//    motor:adelante | motor:atras | motor:izquierda | motor:derecha | motor:parar
//    luz:on | luz:off | luz:auto
//
// Tambien puedes escribir esas ordenes a mano en el Monitor Serie
// (con "Nueva linea" activado) para probar sin la Lenovo.
//
// Respaldo sin internet: la ESP32 sigue creando el WiFi
// "Robot_ESP32" con su pagina en http://192.168.4.1
// ======================================================

// ======================================================
// 1. WIFI DE RESPALDO
// ======================================================

const char* ssid = "Robot_ESP32";
const char* password = "12345678";

WebServer server(80);

// ======================================================
// 2. PINES
// ======================================================

// Motores L298N
#define IN1 26
#define IN2 27
#define IN3 14
#define IN4 12

// Sensor PIR
#define PIR_PIN 34

// Modulo de luz HW-042 (SIG en GPIO13)
#define MOSFET_PIN 13

// Ultrasonico delantero
#define TRIG_DELANTERO 19
#define ECHO_DELANTERO 22

// Ultrasonico trasero
#define TRIG_TRASERO 18
#define ECHO_TRASERO 21

// ======================================================
// 3. VARIABLES DEL SISTEMA
// ======================================================

float distanciaDelantera = -1;
float distanciaTrasera = -1;

bool modoAutomaticoLuz = true;
bool estadoManualLuz = false;

String estadoMotor = "parar";

// Freno automatico ante obstaculos
const bool  FRENO_ACTIVO    = true;
const float DISTANCIA_FRENO = 15.0;   // cm

unsigned long tiempoSensores = 0;
const unsigned long INTERVALO_SENSORES = 500;

String bufferSerial = "";

// ======================================================
// 4. MOTORES
// ======================================================

void aplicarMotor(int a, int b, int c, int d) {
  digitalWrite(IN1, a);
  digitalWrite(IN2, b);
  digitalWrite(IN3, c);
  digitalWrite(IN4, d);
}

void adelante()  { aplicarMotor(HIGH, LOW,  HIGH, LOW);  estadoMotor = "adelante";  }
void atras()     { aplicarMotor(LOW,  HIGH, LOW,  HIGH); estadoMotor = "atras";     }
void izquierda() { aplicarMotor(LOW,  HIGH, HIGH, LOW);  estadoMotor = "izquierda"; }
void derecha()   { aplicarMotor(HIGH, LOW,  LOW,  HIGH); estadoMotor = "derecha";   }
void parar()     { aplicarMotor(LOW,  LOW,  LOW,  LOW);  estadoMotor = "parar";     }

void ejecutarOrdenMotor(const String& orden) {
  if      (orden == "adelante")  adelante();
  else if (orden == "atras")     atras();
  else if (orden == "izquierda") izquierda();
  else if (orden == "derecha")   derecha();
  else if (orden == "parar")     parar();
}

// ======================================================
// 5. LUZ
// ======================================================

void actualizarLuz() {
  if (modoAutomaticoLuz) {
    digitalWrite(MOSFET_PIN, digitalRead(PIR_PIN) == HIGH ? HIGH : LOW);
  } else {
    digitalWrite(MOSFET_PIN, estadoManualLuz ? HIGH : LOW);
  }
}

void encenderLuz()   { modoAutomaticoLuz = false; estadoManualLuz = true;  actualizarLuz(); }
void apagarLuz()     { modoAutomaticoLuz = false; estadoManualLuz = false; actualizarLuz(); }
void luzAutomatica() { modoAutomaticoLuz = true;                           actualizarLuz(); }

void ejecutarOrdenLuz(const String& orden) {
  if      (orden == "on")   encenderLuz();
  else if (orden == "off")  apagarLuz();
  else if (orden == "auto") luzAutomatica();
}

// ======================================================
// 6. ULTRASONICOS HC-SR04
// ======================================================

float medirDistancia(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(3);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long duracion = pulseIn(echoPin, HIGH, 25000UL);
  if (duracion == 0) return -1;

  float distancia = duracion * 0.0343 / 2.0;
  if (distancia < 2 || distancia > 400) return -1;
  return distancia;
}

void leerSensores() {
  distanciaDelantera = medirDistancia(TRIG_DELANTERO, ECHO_DELANTERO);
  delay(30);   // evita interferencia entre los dos sensores
  distanciaTrasera = medirDistancia(TRIG_TRASERO, ECHO_TRASERO);
}

// ======================================================
// 7. ENVIAR DATOS A LA LENOVO (JSON por el cable USB)
// ======================================================

void enviarEstado() {
  String j = "{\"del\":";
  j += String(distanciaDelantera, 2);
  j += ",\"tra\":";
  j += String(distanciaTrasera, 2);
  j += ",\"pir\":";
  j += digitalRead(PIR_PIN) == HIGH ? "1" : "0";
  j += ",\"luz\":";
  j += digitalRead(MOSFET_PIN) == HIGH ? "1" : "0";
  j += ",\"modo\":\"";
  j += modoAutomaticoLuz ? "AUTO" : "MANUAL";
  j += "\",\"motor\":\"";
  j += estadoMotor;
  j += "\"}";
  Serial.println(j);
}

void enviarEvento(const char* evento) {
  Serial.print("{\"evento\":\"");
  Serial.print(evento);
  Serial.println("\"}");
}

// ======================================================
// 8. FRENO DE SEGURIDAD
// ======================================================

void revisarFreno() {
  if (!FRENO_ACTIVO) return;

  bool obstaculoDelante = distanciaDelantera > 0 && distanciaDelantera < DISTANCIA_FRENO;
  bool obstaculoDetras  = distanciaTrasera  > 0 && distanciaTrasera  < DISTANCIA_FRENO;

  if (estadoMotor == "adelante" && obstaculoDelante) {
    parar();
    enviarEvento("FRENO_OBSTACULO_DELANTE");
  } else if (estadoMotor == "atras" && obstaculoDetras) {
    parar();
    enviarEvento("FRENO_OBSTACULO_DETRAS");
  }
}

// ======================================================
// 9. RECIBIR ORDENES POR EL CABLE USB
// ======================================================

void procesarLinea(String linea) {
  linea.trim();
  linea.toLowerCase();
  if (linea.length() == 0) return;

  int sep = linea.indexOf(':');
  if (sep < 0) {
    Serial.println("# orden no valida: " + linea);
    return;
  }

  String tipo  = linea.substring(0, sep);
  String valor = linea.substring(sep + 1);

  if (tipo == "motor") {
    ejecutarOrdenMotor(valor);
    revisarFreno();          // no deja avanzar si ya hay obstaculo
  } else if (tipo == "luz") {
    ejecutarOrdenLuz(valor);
  } else {
    Serial.println("# orden no valida: " + linea);
    return;
  }

  enviarEstado();            // responde al instante con el nuevo estado
}

void leerSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (bufferSerial.length() > 0) {
        procesarLinea(bufferSerial);
        bufferSerial = "";
      }
    } else if (bufferSerial.length() < 64) {
      bufferSerial += c;
    }
  }
}

// ======================================================
// 10. PAGINA WEB DE RESPALDO (192.168.4.1)
// Funciona aunque no haya internet ni Lenovo.
// ======================================================

void pagina() {
  String html = R"rawliteral(
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Robot ESP32</title>
<style>
body{margin:0;font-family:Arial;background:#111827;color:white;text-align:center}
h1{margin-top:25px}
button{width:115px;height:60px;margin:5px;border:none;border-radius:12px;background:#2563eb;color:white;font-size:17px}
.stop{background:#dc2626}.luz{background:#ca8a04}
#estado{margin:20px;padding:15px;background:#374151;border-radius:12px}
</style></head><body>
<h1>ROBOT ESP32</h1>
<div id="estado">Esperando datos...</div>
<h2>CONTROL DE MOVIMIENTO</h2>
<div><button onclick="orden('adelante')">ADELANTE</button></div>
<div>
<button onclick="orden('izquierda')">IZQUIERDA</button>
<button class="stop" onclick="orden('parar')">STOP</button>
<button onclick="orden('derecha')">DERECHA</button>
</div>
<div><button onclick="orden('atras')">ATRAS</button></div>
<h2>CONTROL DE LUZ</h2>
<button class="luz" onclick="fetch('/luz/on')">ENCENDER</button>
<button class="stop" onclick="fetch('/luz/off')">APAGAR</button>
<button onclick="fetch('/luz/auto')">AUTOMATICO</button>
<script>
function orden(m){fetch('/'+m);}
function actualizar(){fetch('/estado').then(r=>r.text()).then(d=>{document.getElementById('estado').innerHTML=d;});}
setInterval(actualizar,1000);
</script></body></html>
)rawliteral";
  server.send(200, "text/html", html);
}

void estadoHTTP() {
  String r = "PIR: ";
  r += digitalRead(PIR_PIN) ? "MOVIMIENTO DETECTADO" : "SIN MOVIMIENTO";
  r += "<br>Delantero: ";
  r += distanciaDelantera > 0 ? String(distanciaDelantera, 2) + " cm" : String("SIN LECTURA");
  r += "<br>Trasero: ";
  r += distanciaTrasera > 0 ? String(distanciaTrasera, 2) + " cm" : String("SIN LECTURA");
  r += "<br>Luz: ";
  r += digitalRead(MOSFET_PIN) ? "ENCENDIDA" : "APAGADA";
  r += modoAutomaticoLuz ? " (AUTO)" : " (MANUAL)";
  r += "<br>Motor: " + estadoMotor;
  server.send(200, "text/html", r);
}

void rutaMotor(const char* ruta, const char* orden) {
  server.on(ruta, [orden]() {
    ejecutarOrdenMotor(orden);
    revisarFreno();
    enviarEstado();
    server.send(200, "text/plain", "OK");
  });
}

void rutaLuz(const char* ruta, const char* orden) {
  server.on(ruta, [orden]() {
    ejecutarOrdenLuz(orden);
    enviarEstado();
    server.send(200, "text/plain", "OK");
  });
}

void configurarServidor() {
  server.on("/", pagina);
  server.on("/estado", estadoHTTP);

  rutaMotor("/adelante",  "adelante");
  rutaMotor("/atras",     "atras");
  rutaMotor("/izquierda", "izquierda");
  rutaMotor("/derecha",   "derecha");
  rutaMotor("/parar",     "parar");

  rutaLuz("/luz/on",   "on");
  rutaLuz("/luz/off",  "off");
  rutaLuz("/luz/auto", "auto");

  server.begin();
}

// ======================================================
// 11. SETUP
// ======================================================

void setup() {
  Serial.begin(115200);

  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  pinMode(PIR_PIN, INPUT);
  pinMode(MOSFET_PIN, OUTPUT);

  pinMode(TRIG_DELANTERO, OUTPUT);
  pinMode(ECHO_DELANTERO, INPUT);
  pinMode(TRIG_TRASERO, OUTPUT);
  pinMode(ECHO_TRASERO, INPUT);
  digitalWrite(TRIG_DELANTERO, LOW);
  digitalWrite(TRIG_TRASERO, LOW);

  parar();
  digitalWrite(MOSFET_PIN, LOW);

  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, password);
  configurarServidor();

  Serial.println();
  Serial.println("# ROBOT ESP32 IoT v3 (USB)");
  Serial.print("# WiFi de respaldo: ");
  Serial.print(ssid);
  Serial.print("  ->  http://");
  Serial.println(WiFi.softAPIP());
  Serial.println("# Listo. Ordenes: motor:adelante | luz:on ...");
}

// ======================================================
// 12. LOOP
// ======================================================

void loop() {
  server.handleClient();
  leerSerial();
  actualizarLuz();

  if (millis() - tiempoSensores >= INTERVALO_SENSORES) {
    tiempoSensores = millis();
    leerSensores();
    revisarFreno();
    enviarEstado();
  }
}
