# 📚 Bookmarks App - Chrome Extension

Una extensión simple y elegante para guardar y organizar tus favoritos, inspirada en Pocket pero con **sincronización en la nube usando GitHub**.

## ✨ Características

- **Guardado rápido**: Un clic para guardar la página actual
- **Extracción automática**: Título, descripción y etiquetas se extraen automáticamente
- **Búsqueda**: Encuentra rápidamente tus favoritos
- **Filtros por etiquetas**: Organiza y filtra por categorías
- **Interfaz moderna**: Diseño limpio y fácil de usar
- **☁️ Sincronización en la nube**: Tus favoritos se sincronizan con GitHub
- **🔄 Multi-dispositivo**: Accede a tus favoritos desde cualquier dispositivo
- **💾 Backup automático**: Tus datos están seguros en GitHub

## 🚀 Instalación

### Instalación manual (desarrollo)

1. **Descarga o clona este repositorio**
   ```bash
   git clone <tu-repositorio>
   cd bookmarks-app
   ```

2. **Abre Chrome y ve a las extensiones**
   - Abre Chrome
   - Ve a `chrome://extensions/`
   - Activa el "Modo desarrollador" (toggle en la esquina superior derecha)

3. **Carga la extensión**
   - Haz clic en "Cargar descomprimida"
   - Selecciona la carpeta del proyecto
   - La extensión aparecerá en tu barra de herramientas

## 📖 Uso

### Guardar una página
1. Navega a la página que quieres guardar
2. Haz clic en el icono de la extensión en la barra de herramientas
3. Haz clic en "💾 Guardar"
4. ¡Listo! La página se guardará con título, descripción y etiquetas automáticas

### Gestionar favoritos
- **Buscar**: Usa el campo de búsqueda para encontrar favoritos
- **Filtrar por etiquetas**: Haz clic en las etiquetas para filtrar
- **Abrir**: Haz clic en cualquier favorito para abrirlo
- **Eliminar**: Usa el botón 🗑️ para eliminar favoritos

### Sincronizar con GitHub
1. Ve a la pestaña "☁️ Sincronizar"
2. Haz clic en "🔗 Conectar con GitHub"
3. Sigue las instrucciones para configurar tu token
4. ¡Disfruta de la sincronización automática!

> 📖 **Ver [GITHUB_SETUP.md](GITHUB_SETUP.md) para instrucciones detalladas de configuración**

## 🛠️ Estructura del proyecto

```
bookmarks-app/
├── manifest.json          # Configuración de la extensión
├── popup/
│   ├── popup.html         # Interfaz del popup
│   ├── popup.css          # Estilos
│   └── popup.js            # Lógica del popup
├── services/
│   ├── githubService.js   # Servicio de GitHub API
│   └── githubAuth.js      # Autenticación con GitHub
├── content.js             # Script que se ejecuta en las páginas
├── background.js          # Service worker
├── icons/                 # Iconos de la extensión
├── GITHUB_SETUP.md        # Guía de configuración de GitHub
└── README.md              # Este archivo
```

## 🔧 Desarrollo

### Tecnologías utilizadas
- **HTML5**: Estructura del popup
- **CSS3**: Estilos modernos con gradientes y animaciones
- **JavaScript ES6+**: Lógica de la aplicación
- **Chrome Extensions API**: Funcionalidad del navegador
- **GitHub API**: Sincronización en la nube
- **OAuth 2.0**: Autenticación segura

### Funcionalidades implementadas
- ✅ Guardado de páginas con metadatos
- ✅ Extracción automática de título y descripción
- ✅ Sistema de etiquetas
- ✅ Búsqueda y filtros
- ✅ Almacenamiento local
- ✅ Interfaz responsive
- ✅ **Sincronización con GitHub**
- ✅ **Autenticación segura**
- ✅ **Sincronización multi-dispositivo**
- ✅ **Backup automático en la nube**

### Próximas funcionalidades
- 🔄 Exportación/importación de datos
- 🔄 Lectura offline de artículos
- 🔄 Categorías personalizadas
- 🔄 Atajos de teclado
- 🔄 Sincronización automática en tiempo real

## 🎨 Personalización

### Cambiar colores
Los colores principales se definen en `popup/popup.css`:
```css
/* Gradiente principal */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Color de acento */
color: #667eea;
```

### Modificar iconos
Los iconos están en formato SVG en `icons/icon.svg` y se convierten automáticamente a PNG.

## 📝 Licencia

Este proyecto es de código abierto. Siéntete libre de modificarlo y distribuirlo.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 🐛 Reportar problemas

Si encuentras algún problema o tienes una sugerencia, por favor abre un issue en el repositorio.

---

**¡Disfruta organizando tus favoritos! 📚✨** 