# DETECTOR DE SUSCRIPCIONES OCULTAS

## Información del Proyecto

| Campo | Detalle |
| :--- | :--- |
| **Título de la Aplicación** | Detector de Suscripciones Ocultas |
| **Materia** | Desarrollo de Aplicaciones Web |
| **Institución (Nacional)** | Tecnológico Nacional de México (TecNM) |
| **Institución (Educativa)** | Secretaría de Educación Pública (SEP) |

---

## Créditos del Proyecto

| Rol | Nombre |
| :--- | :--- |
| **Docente** | Mónica Ruiz Martínez |
| **Equipo de Desarrollo** | De la Luz Hernández Antony |
|  | Mora Ramírez José Antonio |
|  | Brandon Alejandro Romero Guido |

---

## 1. Introducción

El **Detector de Suscripciones Ocultas** es una aplicación web diseñada para ayudar a los usuarios a gestionar su bandeja de entrada de Gmail.  
La herramienta se conecta de forma segura a la cuenta de Google del usuario, analiza sus correos para identificar newsletters y suscripciones activas, y presenta un resumen organizado.

El objetivo principal es permitir visualizar, clasificar en grupos y realizar acciones sobre estas suscripciones, como marcarlas como spam para mantener limpia la bandeja de entrada.

---

## 2. Características Principales

* **Autenticación Segura:** Inicio de sesión con Google mediante OAuth 2.0.
* **Análisis de Correo:** Escanea la cuenta de Gmail para identificar suscripciones.
* **Visualización de Suscripciones:** Presentación de cada newsletter en tarjetas con remitente, correo y categorías.
* **Gestión de Grupos (CRUD):**
    * **Crear:** Permite crear grupos personalizados (requiere backend PHP con XAMPP).
    * **Leer:** Lista los grupos existentes.
    * **Actualizar:** Edita nombre, descripción y color de un grupo.
    * **Eliminar:** Elimina grupos.
* **Organización de Suscripciones:** Agregar o quitar suscripciones de los grupos, y filtrar por grupo.
* **Acciones de Limpieza:**
    * **Marcar como Spam:** Envía los correos de la suscripción a la carpeta de spam.
    * **Desmarcar Spam:** Devuelve los correos a la bandeja de entrada.

---

## 3. Arquitectura y Stack Tecnológico

La aplicación utiliza una arquitectura híbrida: Next.js para la lógica principal y PHP/XAMPP para la gestión de grupos.

### Frontend

* **Framework:** Next.js.
* **Componentes:** React (estructura modular por componentes).
* **Autenticación:** NextAuth.js con proveedor de Google.
* **Hooks principales:**  
  `useEmailAnalysis.js`, `useNewsletterGroups.js`, `useSubscriptions.js`.

### Backend (API de Next.js)

* Maneja la lógica principal y la comunicación con la API de Gmail.
* **Endpoints de ejemplo:** `analyze-emails`, `mark-spam`, `unmark-spam`, `unsubscribe`.

### Backend (PHP para Grupos)

* Scripts PHP encargados del CRUD de los grupos.
* **Scripts principales:**  
  `create-group.php`, `read-groups.php`, `delete-group.php`,  
  `update-group.php`, `add-newsletter.php`, `remove-newsletter.php`.

### Servicios Externos

* **Google Cloud Console:** Configuración del cliente OAuth 2.0 y habilitación de la API de Gmail.

---

## 4. Guía de Puesta en Marcha (Instalación Local)

### A. Configuración del Backend (PHP/XAMPP)

1. Instalar XAMPP.
2. Iniciar Apache y MySQL.
3. Colocar la carpeta `backend` dentro de `htdocs`.
4. Configurar la conexión a la base de datos en `backend/db.php` y verificar la creación de tablas.

### B. Configuración de Google Cloud

1. Crear un proyecto en Google Cloud Console.
2. Activar la API de Gmail.
3. Crear un cliente OAuth 2.0 tipo “Aplicación web”.
4. Configurar los orígenes autorizados:
    * `http://localhost:3000`
    * `http://localhost:8000`
5. Configurar el URI de redireccionamiento:  
   `http://localhost:3000/api/auth/callback/google`
6. Guardar el ID y el secreto del cliente.

### C. Configuración del Frontend (Next.js)
```bash
1. Clonar el repositorio.
2. Ejecutar `npm install`.
3. Crear el archivo `.env.local` con el contenido:
GOOGLE_CLIENT_ID=TU_ID_DE_CLIENTE
GOOGLE_CLIENT_SECRET=TU_SECRETO_DE_CLIENTE
NEXTAUTH_SECRET=UNA_CLAVE_SECRETA_ALEATORIA
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL="file:./dev.db"
```
## 5. Flujo de Uso de la Aplicación (Recorrido Visual)

1. **Inicio y Autenticación:**  
   El usuario llega a la pantalla de inicio y hace clic en "Comenzar Ahora", siendo redirigido para elegir una cuenta de Google.

2. **Advertencia de Seguridad (Desarrollo):**  
   Debido a que la app no ha sido verificada por Google, aparece una advertencia.  
   El usuario debe hacer clic en "Ir a Email Subscription Detector (no seguro)" para continuar.

3. **Solicitud de Permisos:**  
   Google informa al usuario que la app accederá a su nombre, email y perfil.  
   Se solicitan permisos explícitos para leer, redactar, enviar y gestionar correos de Gmail.

4. **Dashboard Principal:**  
   Tras otorgar permisos, el usuario es redirigido al dashboard principal.  
   El panel "Mis Grupos" muestra los grupos creados (esta sección depende de que XAMPP esté en ejecución).

5. **Análisis y Resultados:**  
   El usuario hace clic en "Analizar Emails".  
   Al terminar, se muestra una lista de "Suscripciones Encontradas", donde cada suscripción aparece en una tarjeta con acciones disponibles.

6. **Gestión de Suscripciones:**
   * **Marcar como Spam:** Permite enviar los correos de una suscripción a la carpeta de spam de Gmail.
   * **Agregar a Grupo:** El usuario puede asignar una suscripción a un grupo existente.
   * **Quitar de Grupo:** Si una suscripción ya está en un grupo, se puede quitar.

---

## 6. Conclusiones y Futuras Mejoras

La aplicación demuestra una implementación robusta de la autenticación OAuth 2.0 de Google, y la capacidad de identificar, visualizar y gestionar suscripciones mediante acciones como "Marcar como Spam" y la organización en grupos personalizados aporta un valor significativo al usuario.

### Futuras Mejoras

1. **Unificación del Backend:**  
   Migrar la lógica del backend PHP (actualmente en XAMPP) a la API de Next.js.  
   Esto centralizaría la lógica del servidor en un solo proyecto y eliminaría la dependencia de XAMPP.

2. **Implementación de "Desuscribir":**  
   Añadir una funcionalidad directa para desuscribirse de newsletters.  
   Implementar la lógica para detectar y ejecutar automáticamente el enlace de desuscripción sería una mejora clave.

3. **Despliegue y Verificación:**  
   Desplegar la aplicación en un dominio público y completar la verificación de la app en Google Cloud Console.  
   Esto eliminaría la advertencia de "app no verificada".

