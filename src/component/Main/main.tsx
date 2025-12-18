// Provide state management
// import { useDataContext } from "../../context/dataContext";

import { useRef, useEffect } from "react";
// import { Button } from "antd";

import "./style.css";

export default function Main() {
  // const data = useDataContext();
  const mainRef = useRef<any>(null);
  mainRef.current = "这是main的ref";
  useEffect(() => {
    console.log(mainRef);
  }, []);

  // function handleClick() {
  //   console.log(mainRef.current);
  // }

  return (
    <>
      <h1>这里是主要内容</h1>
      {/* <Button type="text" onClick={handleClick}> 点击</Button> */}
    </>
  );
}
