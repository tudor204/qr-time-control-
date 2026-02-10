# QR Time Control 🕐

Sistema de control de asistencia mediante códigos QR para empresas. Permite a los empleados fichar entrada/salida escaneando un código QR, y a los administradores gestionar empleados, vacaciones y generar reportes detallados.

## 🚀 Características

- **Autenticación segura** con Firebase Authentication
- **Fichaje QR**: Entrada y salida mediante escaneo de código QR
- **Roles de usuario**: Empleado y Administrador
- **Dashboard de empleado**: Historial personal, horas trabajadas, vacaciones programadas
- **Dashboard de administrador**:
  - Gestión de empleados
  - Historial completo de fichajes
  - Sistema de reportes avanzado con filtros
  - Resúmenes mensuales
  - Exportación a PDF
- **Gestión de vacaciones**: Planificación y visualización de periodos vacacionales
- **Productividad semanal**: Widget con seguimiento de horas trabajadas
- **Responsive**: Diseño adaptado a móviles y tablets

## 🛠️ Tecnologías

- **Frontend**: React + TypeScript + Vite
- **Backend**: Firebase (Firestore + Authentication)
- **Estilos**: Tailwind CSS
- **PDF**: jsPDF + autoTable
- **QR**: html5-qrcode

## 📦 Instalación

### Prerrequisitos
- Node.js 18+ 
- npm o yarn
- Cuenta de Firebase

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/qr-time-control.git
   cd qr-time-control
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Edita `.env` y añade tus credenciales de Firebase:
   ```env
   VITE_FIREBASE_API_KEY=tu_api_key
   VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
   VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
   VITE_FIREBASE_APP_ID=tu_app_id
   VITE_RECAPTCHA_SITE_KEY=tu_recaptcha_key (opcional)
   ```

4. **Configurar Firestore**
   - Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
   - Habilita Firestore Database
   - Habilita Authentication (Email/Password)
   - Despliega las reglas de seguridad desde `firestore.rules`

5. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:5173`

6. **Compilar para producción**
   ```bash
   npm run build
   ```

## 👤 Asignar Rol de Administrador

Para asignar el rol de administrador a un usuario:

1. **Descargar Service Account Key** desde Firebase Console:
   - Project Settings → Service Accounts → Generate new private key
   - Guardar el archivo JSON en la raíz del proyecto

2. **Ejecutar el script**:
   ```bash
   node scripts/set-admin-claim.js usuario@ejemplo.com ADMIN
   ```

3. **El usuario debe cerrar sesión y volver a entrar** para que los cambios surtan efecto

⚠️ **Importante**: El archivo de Service Account contiene credenciales sensibles. Nunca lo subas a GitHub (ya está en `.gitignore`).

## 📱 Uso

### Empleado
1. Iniciar sesión con email y contraseña
2. Click en "Fichar Entrada/Salida"
3. Escanear el código QR del punto de acceso
4. Ver historial personal y horas trabajadas

### Administrador
1. Iniciar sesión como administrador
2. **Pestaña History**: Ver todos los fichajes
3. **Pestaña Employees**: Gestionar empleados y vacaciones
4. **Pestaña Reports**: 
   - Filtrar por empleado y fechas
   - Ver resúmenes mensuales
   - Exportar reportes a PDF
5. **Pestaña Settings**: Generar e imprimir código QR

## 🏗️ Estructura del Proyecto

```
qr-time-control/
├── src/
│   ├── components/
│   │   ├── Admin/
│   │   │   └── ReportsTab.tsx
│   │   ├── Auth/
│   │   │   └── LoginForm.tsx
│   │   ├── Dashboard/
│   │   │   └── ProductivityWidget.tsx
│   │   └── Scanner.tsx
│   ├── services/
│   │   ├── firebaseConfig.ts
│   │   └── dbService.ts
│   ├── utils/
│   │   ├── timeCalculations.ts
│   │   ├── employeeStatus.ts
│   │   └── reportUtils.ts
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── scripts/
│   └── set-admin-claim.js
├── firestore.rules
├── .env.example
└── package.json
```

## 🔒 Seguridad

- ✅ Variables de entorno para credenciales
- ✅ Firestore Security Rules
- ✅ Custom Claims para roles
- ✅ App Check con reCAPTCHA (opcional)
- ✅ Validación de fichajes (máximo 2 por día)

## 📄 Licencia

MIT

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📧 Contacto

Para preguntas o soporte, abre un issue en GitHub.
