// Простая версия хука для уведомлений
export function useToast() {
  return {
    toast: (props: { title: string; description?: string; variant?: string }) => {
      console.log("🔔 Уведомление:", props.title, props.description);
      // Если хочешь, чтобы всплывало системное окно, раскомментируй строку ниже:
      // alert(`${props.title}: ${props.description}`);
    },
  };
}