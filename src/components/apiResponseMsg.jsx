export const ApiResponseMsg = ({ message }) => {
  return (
    <p
      className={`${
        message.includes("successfully") ? "text-green-500" : "text-errorColor"
      } text-sm font-semibold px-4`}
    >
      {message}
    </p>
  );
};
