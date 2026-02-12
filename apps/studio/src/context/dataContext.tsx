import { createContext, useContext } from "react";

type DataType = {
  id: string;
  type: string;
  main: string;
};

const defaultValue: DataType = {
  id: "1",
  type: "dataContext",
  main: "这是来自 dataContext 的数据",
};

const DataContext = createContext<DataType>(defaultValue);

export const useDataContext = (): DataType => {
  return useContext(DataContext);
};

export const DataProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value?: DataType;
}) => {
  const mergedValue = value || defaultValue;

  return (
    <DataContext.Provider value={mergedValue}>{children}</DataContext.Provider>
  );
};
