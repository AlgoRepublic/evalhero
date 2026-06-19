import { Layout } from 'antd';
import { useRef, ReactNode } from 'react';

const { Header } = Layout;

type HeaderNavProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};

const HeaderNav = ({ children, ...others }: HeaderNavProps) => {
  const nodeRef = useRef(null);

  return <Header ref={nodeRef} {...others}>{children}</Header>;
};

export default HeaderNav;
