# 🔧 Configuración de GitHub para Bookmarks App

## 📋 Pasos para configurar la sincronización con GitHub

### 1. Crear un Token de Acceso Personal

1. **Ve a GitHub Settings**
   - Abre [GitHub Settings > Tokens](https://github.com/settings/tokens)
   - Haz clic en "Generate new token (classic)"

2. **Configurar el Token**
   - **Note**: `Bookmarks App - Favoritos`
   - **Expiration**: `No expiration` (o el tiempo que prefieras)
   - **Scopes**: Selecciona `repo` (acceso completo a repositorios)

3. **Generar y Copiar**
   - Haz clic en "Generate token"
   - **IMPORTANTE**: Copia el token inmediatamente (no podrás verlo después)
   - El token comenzará con `ghp_` seguido de caracteres alfanuméricos

### 2. Configurar la Extensión

1. **Abrir la extensión**
   - Haz clic en el icono de Bookmarks App en tu barra de herramientas

2. **Ir a la pestaña "Sincronizar"**
   - Haz clic en la pestaña "☁️ Sincronizar"

3. **Conectar con GitHub**
   - Haz clic en "🔗 Conectar con GitHub"
   - Pega tu token personal en el campo de texto
   - Haz clic en "🔍 Validar" para verificar que el token funciona
   - Una vez validado, haz clic en "Configurar"

### 3. ¿Qué sucede automáticamente?

Una vez conectado, la extensión:

- ✅ **Crea un repositorio privado** llamado `favoritos` en tu cuenta de GitHub
- ✅ **Guarda tus favoritos** en un archivo `bookmarks.json`
- ✅ **Sincroniza automáticamente** entre todos tus dispositivos
- ✅ **Mantiene un historial** de todos los cambios

### 4. Estructura del Repositorio

```
favoritos/
├── bookmarks.json    # Tus favoritos en formato JSON
├── README.md         # Información del repositorio
└── .gitignore        # Archivos a ignorar
```

### 5. Funciones de Sincronización

#### **Sincronización Automática**
- Cada vez que guardas un favorito, se sube a GitHub
- Al abrir la extensión, se descargan los favoritos más recientes

#### **Sincronización Manual**
- **⬇️ Descargar desde GitHub**: Obtiene los favoritos del repositorio
- **⬆️ Subir a GitHub**: Envía tus favoritos locales al repositorio
- **🔄 Sincronización completa**: Hace ambas operaciones

### 6. Ventajas de usar GitHub

- 🆓 **Gratuito**: Sin costos de servidor
- 🔒 **Privado**: Tu repositorio es privado por defecto
- 📱 **Multi-dispositivo**: Sincroniza entre todos tus dispositivos
- 🔄 **Versionado**: Historial completo de cambios
- 💾 **Backup**: Tus datos están seguros en GitHub
- 🌐 **Acceso web**: Puedes ver tus favoritos en GitHub.com

### 7. Solución de Problemas

#### **Error: "Token inválido"**
- Verifica que el token tenga permisos de `repo`
- Asegúrate de que el token no haya expirado
- Usa el botón "🔍 Validar" para verificar el token
- Genera un nuevo token si es necesario

#### **Error: "No se pudo crear repositorio"**
- Verifica que tengas permisos para crear repositorios
- Asegúrate de que no exista ya un repositorio llamado `favoritos`

#### **Error: "No se pudo sincronizar"**
- Verifica tu conexión a internet
- Asegúrate de que el token sea válido
- Intenta desconectar y volver a conectar

### 8. Seguridad

- 🔐 **Token privado**: Nunca compartas tu token personal
- 🔒 **Repositorio privado**: Solo tú puedes acceder a tus favoritos
- 🛡️ **Datos locales**: Los favoritos también se guardan localmente
- 🔄 **Sincronización segura**: Usa HTTPS para todas las comunicaciones

### 9. Desconectar GitHub

Si quieres dejar de usar la sincronización:

1. Ve a la pestaña "Sincronizar"
2. Haz clic en "🔌 Desconectar"
3. Tus favoritos seguirán guardados localmente
4. Puedes volver a conectar en cualquier momento

### 10. Migrar a otro dispositivo

Para usar tus favoritos en otro dispositivo:

1. Instala la extensión en el nuevo dispositivo
2. Ve a la pestaña "Sincronizar"
3. Conecta con GitHub usando el mismo token
4. Haz clic en "⬇️ Descargar desde GitHub"
5. ¡Todos tus favoritos estarán disponibles!

---

**¡Disfruta de la sincronización en la nube! ☁️✨**
