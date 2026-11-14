// Estado compartido de la interfaz móvil (menú lateral abierto, etc.).
export const ui = $state({
    menuAbierto: false
});

export const abrirMenu = () => (ui.menuAbierto = true);
export const cerrarMenu = () => (ui.menuAbierto = false);
