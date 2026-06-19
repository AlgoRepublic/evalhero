import { Layout } from 'antd';

const { Footer } = Layout;

type FooterNavProps = React.HTMLAttributes<HTMLDivElement>;

const FooterNav = ({ ...others }: FooterNavProps) => {
  return (
    <Footer {...others}>Eval Hero © {new Date().getFullYear()}</Footer>
  );
};

export default FooterNav;
