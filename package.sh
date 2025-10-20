#!/bin/bash

# 🚀 Script de Empaquetado para Bookmarks App
# Este script prepara la extensión para distribución

echo "📦 Empaquetando Bookmarks App para distribución..."

# Variables
VERSION="1.0.0"
PROJECT_NAME="bookmarks-app"
PACKAGE_NAME="${PROJECT_NAME}-v${VERSION}.zip"
DIST_DIR="dist"

# Crear directorio de distribución
echo "📁 Creando directorio de distribución..."
mkdir -p $DIST_DIR

# Copiar archivos necesarios
echo "📋 Copiando archivos..."
cp manifest.json $DIST_DIR/
cp background.js $DIST_DIR/
cp content.js $DIST_DIR/
cp -r popup/ $DIST_DIR/
cp -r services/ $DIST_DIR/
cp -r icons/ $DIST_DIR/
cp README.md $DIST_DIR/
cp GITHUB_SETUP.md $DIST_DIR/

# Excluir archivos de desarrollo
echo "🧹 Excluyendo archivos de desarrollo..."
rm -f $DIST_DIR/test.html
rm -f $DIST_DIR/DEPLOYMENT.md
rm -f $DIST_DIR/package.sh

# Crear archivo ZIP
echo "📦 Creando archivo ZIP..."
cd $DIST_DIR
zip -r ../$PACKAGE_NAME . -x "*.git*" "*.DS_Store*"
cd ..

# Limpiar directorio temporal
echo "🧹 Limpiando archivos temporales..."
rm -rf $DIST_DIR

# Verificar contenido del ZIP
echo "🔍 Verificando contenido del paquete..."
unzip -l $PACKAGE_NAME

echo ""
echo "✅ ¡Empaquetado completado!"
echo "📦 Archivo creado: $PACKAGE_NAME"
echo "📏 Tamaño: $(du -h $PACKAGE_NAME | cut -f1)"
echo ""
echo "🚀 Para instalar:"
echo "   1. Extrae el archivo ZIP"
echo "   2. Abre Chrome y ve a chrome://extensions/"
echo "   3. Activa 'Modo desarrollador'"
echo "   4. Haz clic en 'Cargar descomprimida'"
echo "   5. Selecciona la carpeta extraída"
echo ""
echo "📖 Ver README.md y GITHUB_SETUP.md para más información"
