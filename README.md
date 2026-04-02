# FBI Embajadores Amigos 🕊️

Este es el repositorio oficial de la aplicación web "FBI Embajadores Amigos", desarrollada para el Congreso FBI. El objetivo de la aplicación es inspirar a la juventud a pasar del algoritmo a convertirse en un agente espiritual activo.

El diseño transmite luz, pureza y tecnología moderna mediante un tema claro vibrante, acentos dorados y elementos 3D sutiles.

## Arquitectura y Stack 🛠️

- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript
- **Estilizos**: Tailwind CSS v4, customizado con tokens de diseño en `app/globals.css`
- **Componentes 3D**: Three.js a través de `@react-three/fiber` y `@react-three/drei`
- **Animaciones**: GSAP y Framer Motion
- **Iconos**: Lucide React
- **Base de datos (BaaS)**: Supabase

## Requisitos Previos

- Node.js versión 20.x o superior.
- Una cuenta en Supabase para habilitar las funcionalidades backend reales (si vas a pasar la Fase Mockup).

## Instalación y Ejecución Local 🚀

1. **Clona y ubícate en la carpeta del repositorio** (o usa esta misma carpeta `fbi-embajadores-amigos` ya generada).

2. **Instala las dependencias**
   ```bash
   npm install
   ```

3. **Configura Supabase**  
   Crea un archivo `.env.local` en la raíz del proyecto y agrega tus claves de Supabase. De lo contrario, la API utilizará "mock data" automáticamente para visualizar el contenido sin credenciales.

   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   ```

4. **Corre el entorno de desarrollo**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador preferido.

## Comandos Útiles

- `npm run dev`: Inicia el entorno de desarrollo.
- `npm run build`: Genera la versión de producción optimizada.
- `npm start`: Levanta el servidor local con la versión de producción compilada.
- `npm run lint`: Encuentra y repara problemas en el código fuente de Next.js.

## Estructura del Proyecto

- `app/` - CÓDIGO CORE. Layout, API y vistas.
- `components/sections/` - Secciones funcionales de la Landing Page (Hero, Eventos, Comunidad, etc).
- `components/three/` - Experiencias inmersivas 3D usando WebGL.
- `components/ui/` - Componentes visuales genéricos como Navbar, Footer y tarjetas.
- `lib/` - Lógica de backend conectada a Supabase.
- `types/` - Definiciones de tipado TypeScript para módulos abstractos.

Hecho con luz y propósito para los embajadores del Congreso FBI.
