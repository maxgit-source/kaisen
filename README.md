# Argensystem - Enterprise Resource Planning (ERP)

![Status](https://img.shields.io/badge/Status-Proprietary_Software-red)
![Stack](https://img.shields.io/badge/Stack-Node.js_|_React_|_Python_|_PostgreSQL-blue)
![Focus](https://img.shields.io/badge/Focus-Fintech_&_AI-success)

> **⚠️ AVISO LEGAL / LEGAL NOTICE**
>
> Este repositorio contiene el código fuente de **Argensystem**, un software propietario.
> **Este código se expone públicamente ÚNICAMENTE con fines de demostración profesional y portafolio.**
>
> * ⛔ **PROHIBIDA SU DISTRIBUCIÓN:** No se permite la descarga, copia, bifurcación (fork) ni uso de este código sin autorización escrita.
> * ⛔ **PROHIBIDO SU USO COMERCIAL:** Este software está protegido por leyes de derechos de autor.
>
> *This code is for showcase purposes only. Unauthorized copying, distribution, or use is strictly prohibited.*

---

## 🚀 Visión General

**Argensystem** es una plataforma integral de gestión empresarial diseñada para operar en entornos híbridos (Escritorio/Nube) con alta tolerancia a fallos de red. A diferencia de los ERP tradicionales, integra un núcleo de **Inteligencia Artificial** para la toma de decisiones financieras y logísticas en tiempo real.

### 🏗️ Arquitectura del Sistema

El sistema utiliza una arquitectura de microservicios híbrida para garantizar la operatividad continua:

* **Core Backend (Node.js):** Maneja la lógica transaccional, facturación y sincronización.
* **Intelligence Layer (Python/FastAPI):** Microservicio dedicado a modelos predictivos y análisis de datos.
* **Cliente Híbrido (Electron + React):** Aplicación de escritorio "Offline-First" que sincroniza con la nube cuando hay conexión.
* **Persistencia:** PostgreSQL (Nube) + SQLite (Local) con replicación asíncrona.

---

## 💎 Módulos Críticos & Ingeniería

### 1. Motor de Facturación Electrónica (AFIP/ARCA)
Implementación nativa ("Bare metal") de los protocolos gubernamentales de facturación, sin depender de librerías de terceros para garantizar seguridad y control.
* **Protocolo WSAA:** Autenticación criptográfica con manejo de certificados X.509 y firmas digitales (OpenSSL).
* **Cifrado:** Las credenciales fiscales (`.key`, `.crt`) se almacenan encriptadas con **AES-256-GCM**.
* **Alta Disponibilidad:** Sistema de reintentos y caché de tokens (TA) para minimizar la latencia con los servidores de AFIP.

### 2. Capa de Inteligencia Artificial (AI Services)
Un puente agnóstico de proveedores que permite inyectar inteligencia en flujos de trabajo tradicionales:
* **Dynamic Pricing:** Algoritmo en Python (`scikit-learn`) que sugiere ajustes de precios basándose en la rotación de stock y demanda histórica.
* **Asistente CRM:** Integración con LLMs (OpenAI, DeepSeek, Local Llama) para redactar correos a clientes y resumir oportunidades de venta.
* **Forecasting:** Predicción de quiebres de stock utilizando análisis de series temporales.

### 3. Infraestructura de Sincronización (Cloud Sync)
Sistema robusto para mantener la consistencia de datos entre sucursales desconectadas:
* **Colas de Sincronización:** Registro de eventos locales que se procesan en lote al recuperar conexión.
* **Resolución de Conflictos:** Lógica para manejar ediciones concurrentes en múltiples puntos de venta.

---

## 🛠️ Stack Tecnológico

| Área | Tecnologías |
|------|-------------|
| **Backend** | Node.js, Express, Python (FastAPI), C++ (Native Modules) |
| **Frontend** | React, TypeScript, TailwindCSS, Electron |
| **Data** | PostgreSQL, SQLite, Redis |
| **DevOps** | Docker, Github Actions, Nginx |
| **Security** | OpenSSL, JWT, AES-256 Encryption |

---

## 🔒 Seguridad

Este sistema maneja información financiera sensible. Se han implementado múltiples capas de seguridad:
1.  **Validación de Licencias:** Sistema de DRM propietario para control de activaciones por hardware.
2.  **Auditoría:** Registro inmutable de todas las acciones de usuarios (Audit Logs).
3.  **Roles & Permisos:** Control de acceso granular (RBAC) a nivel de API.

---

### Contacto

Este proyecto fue desarrollado por **[Maximo Lavagetto]**.
Para consultas sobre la arquitectura o implementación técnica, por favor contactar a través de [maxilavagetto@gmail.com].

© 2026 Argensystem. Todos los derechos reservados.
