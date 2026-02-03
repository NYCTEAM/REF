import './globals.css'

export const metadata = {
  title: '推荐系统',
  description: '一层关系推荐系统',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
