import { createApp } from 'vue';
import Demo from './pivot.vue';

export function bootstrap(): void {
  createApp(Demo).mount('#app');
}
