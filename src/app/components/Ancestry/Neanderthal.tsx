interface NeanderthalProps {
  percentage: number;
}

const Neanderthal: React.FC<NeanderthalProps> = ({ percentage }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">尼安德特比例</h3>
      <p className="text-gray-600">尼安德特比例：{percentage.toFixed(1)}%</p>
      {/* <img src="/path/to/neanderthal-image.png" alt="尼安德特比例" className="mt-4" /> */}
    </div>
  );
};

export default Neanderthal;