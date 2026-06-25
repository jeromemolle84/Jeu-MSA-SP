@echo off
title Mission ESSOC - MSA Alpes Vaucluse
echo ============================================
echo   Mission ESSOC - La confiance en action
echo   MSA Alpes Vaucluse
echo ============================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    echo Lancement d'un serveur local sur http://localhost:8000
    echo Le navigateur va s'ouvrir. Laissez cette fenetre ouverte pendant le jeu.
    echo Fermez cette fenetre pour quitter.
    echo.
    start "" http://localhost:8000
    python -m http.server 8000
) else (
    echo Python n'a pas ete detecte.
    echo Ouverture directe de index.html dans le navigateur.
    echo.
    echo Si les images ne s'affichent pas, installez Python
    echo ou ouvrez le jeu via Chrome / Edge / Firefox.
    echo.
    start "" index.html
)
