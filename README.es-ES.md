# **KinX - Un Exportador de Kindroid**

**KinX** es una herramienta de línea de comandos potente y segura para exportar todos tus datos y archivos multimedia del servicio Kindroid. Proporciona un respaldo local completo de tus perfiles de Kin, mensajes de chat, diarios, selfies y videos.

La herramienta se comunica directamente con el backend de Firebase de Kindroid, al igual que la aplicación oficial, para garantizar una exportación de datos exhaustiva y precisa. Cuenta con un menú interactivo intuitivo para seleccionar qué exportar y gestiona el descifrado de los datos sensibles localmente en tu máquina.

## **Características**

* **Exportación Exhaustiva:** Realiza respaldos de Kins, Chats Grupales y el Diario Global.
* **Descarga Completa de Multimedia:** Después de exportar los datos de un Kin, puede descargar todas las imágenes de selfies y videos asociados en carpetas locales.
* **Modo "Exportar Todo":** Una potente opción de un solo clic para respaldar toda tu cuenta (cada Kin, Grupo, Diario y todos los archivos multimedia) de forma no interactiva.
* **Datos Completos:** Para cada Kin, exporta:
  * Datos del Perfil (trasfondo/backstory, recuerdos clave, etc.)
  * Mensajes de Chat
  * Mensajes Fijados
  * Entradas del Diario
  * Selfies y Videos (metadatos y archivos multimedia)
* **Seguro y Privado:** Tu token de autenticación y los datos descifrados nunca se envían a ningún servidor de terceros. Todo el descifrado ocurre localmente.
* **Intuitivo:** Un menú interactivo te permite navegar y elegir exactamente qué deseas exportar.
* **Inteligente y Concurrentemente:** Utiliza consultas a la API eficientes para recuperar datos y descarga archivos multimedia en paralelo para máxima velocidad.
* **Salida Legible:** Todos los datos se guardan en carpetas organizadamente y en archivos JSON legibles para humanos.

## **Requisitos**

* [Node.js](https://nodejs.org/) (se recomienda la versión 18.x o superior)

## **Uso**

### **1. Obtén el Script**

Descarga el script `kinx.mjs` en una carpeta de tu computadora.

### **2. Encuentra tu Firebase Refresh Token**

**⚠️ Advertencia:** El refresh token actúa como una contraseña a largo plazo para tu cuenta. **Mantenlo en secreto y seguro.**

1. Abre Kindroid en un navegador web (como Chrome o Firefox).
2. Abre las **Herramientas de Desarrollador** del navegador (generalmente presionando F12 o haciendo clic derecho en la página y seleccionando "Inspeccionar").
3. Ve a la pestaña **Application** (puede llamarse "Almacenamiento" en Firefox).
4. En el lado izquierdo, busca y expande la sección **IndexedDB**. Selecciona la opción `firebaseLocalStorageDb` dentro de ella.
5. Aparecerá una tabla. Busca la clave que se parece a `firebase:authUser:AIza...:[DEFAULT]`. Haz clic en esa fila.
6. Aparecerá un panel de valores debajo o al lado. Dentro de este panel, verás la propiedad `value`, que contiene un bloque de texto JSON.
7. Busca la propiedad `refreshToken` dentro de ese texto y **copia cuidadosamente todo su valor** (la cadena larga dentro de las comillas).

### **3. Ejecuta el Exportador**

Abre tu terminal o símbolo del sistema, navega hasta la carpeta donde guardaste el script y ejecútalo utilizando uno de los dos métodos a continuación.

#### **Método A: Prompt Interactivo (Recomendado)**

```
node kinx.mjs
```

El script te pedirá de forma segura que pegues tu Firebase refresh token. El token estará oculto con asteriscos (*) y no se guardará en el historial de tu terminal.

#### **Método B: Variable de Entorno (Avanzado/Scripting)**

Este método es más seguro ya que evita que el token se guarde en el historial de tu terminal.

* **macOS/Linux:**
```
  KINDROID_REFRESH_TOKEN="PEGA_TOKEN_AQUI" node kinx.mjs
```

* **Windows (CMD):**
```
  set KINDROID_REFRESH_TOKEN="PEGA_TOKEN_AQUI" && node kinx.mjs
```

* **Windows (PowerShell):**
```
  $env:KINDROID_REFRESH_TOKEN="PEGA_TOKEN_AQUI"; node kinx.mjs
```

### **4. Navega por el Menú**

Una vez autenticado, verás el menú principal:

```
--- Sources ---  
  [0] Kins  
  [1] Group Chats  
  [2] Global Journal  
  [3] Export All
```

Choose source (Esc to exit):

* **Exportación Selectiva:** Elige las opciones 0, 1 o 2 para explorar y seleccionar elementos individuales para exportar. Después de exportar un Kin, se te preguntará si deseas descargar su multimedia.
* **Respaldo Completo:** Elige la opción 3 para exportar todo de tu cuenta, incluyendo todos los archivos multimedia. Aparecerá un mensaje de confirmación antes de comenzar.
* Presiona Esc en cualquier momento para volver atrás o para salir del menú principal.

## **Estructura de Salida**

El script creará una estructura de directorios para almacenar tus datos exportados:

```
.
├── Kins/  
│   └── Kin_Name (kin_id)/  
│       ├── Selfies/  
│       │   ├── image_id_1.jpg  
│       │   └── image_id_2.jpg  
│       ├── Video Selfies/  
│       │   └── video_id_1.mp4  
│       ├── profile.json  
│       ├── chat_messages.json  
│       ├── journal.json  
│       ├── selfies.json  
│       └── video_selfies.json  
│  
├── Group Chats/  
│   └── Group_Name (group_id)/  
│       ├── profile.json  
│       └── chat_messages.json  
│  
└── Global Journal/  
    └── global_journal.json
```

## **Advertencia de Seguridad**

Tu Firebase Refresh Token proporciona acceso completo a tu cuenta de Kindroid. **Trátalo como una contraseña.**

* No lo compartas con nadie.
* No lo subas a un repositorio público de Git.
* Considera usar el método de variable de entorno para mayor seguridad.

## **Descargo de Responsabilidad**

Esta es una herramienta de terceros y no está afiliada, respaldada ni soportada por Kindroid. Se proporciona para uso personal para ayudar a los usuarios a respaldar sus propios datos. **Úsala bajo tu propio riesgo.**
