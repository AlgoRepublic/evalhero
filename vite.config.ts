import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // build: {
  //   rollupOptions: {
  //     output: {
  //       manualChunks: (id) => {
  //         // Vendor chunks
  //         if (id.includes('node_modules')) {
  //           // React ecosystem
  //           if (
  //             id.includes('react') ||
  //             id.includes('react-dom') ||
  //             id.includes('react-router')
  //           ) {
  //             return 'vendor-react';
  //           }
  //           // Ant Design
  //           if (id.includes('antd') || id.includes('@ant-design')) {
  //             return 'vendor-antd';
  //           }
  //           // TipTap editor
  //           if (
  //             id.includes('@tiptap') ||
  //             id.includes('prosemirror') ||
  //             id.includes('lowlight')
  //           ) {
  //             return 'vendor-tiptap';
  //           }
  //           // Firebase
  //           if (id.includes('firebase')) {
  //             return 'vendor-firebase';
  //           }
  //           // Charts
  //           if (id.includes('@ant-design/charts')) {
  //             return 'vendor-charts';
  //           }
  //           // Maps (Leaflet)
  //           if (id.includes('leaflet')) {
  //             return 'vendor-maps';
  //           }
  //           // Other utilities
  //           if (
  //             id.includes('lodash') ||
  //             id.includes('dayjs') ||
  //             id.includes('uuid') ||
  //             id.includes('axios') ||
  //             id.includes('yjs') ||
  //             id.includes('y-protocols')
  //           ) {
  //             return 'vendor-utils';
  //           }
  //           // Everything else from node_modules
  //           return 'vendor-misc';
  //         }
  //       },
  //     },
  //   },
  //   chunkSizeWarningLimit: 1000, // Increase limit after optimization
  // },
});
