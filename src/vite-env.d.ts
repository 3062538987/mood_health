/// <reference types="vite/client" />

// 声明SCSS文件类型
declare module "*.scss" {
  const content: Record<string, string>;
  export default content;
}
