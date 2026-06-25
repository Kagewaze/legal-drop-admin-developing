import { MdClose } from "react-icons/md";
import { useOrdersContext } from "../utils/ordersContext";

export const ImageModal = ({ data, closeImgModal }) => {
  return (
    <article className=" bg-black fixed z-30 inset-0 bg-opacity-50 backdrop-blur-sm  px-4 pt-8">
      <button onClick={() => closeImgModal(false)} className=" ml-auto block">
        <MdClose size={34} className=" text-primaryYellow mb-8" />
      </button>
      <div
        className={`border border-primaryYellow grid place-items-center gap-4  ${
          Array.isArray(data) && "md:grid-cols-2 "
        }  h-[80vh] py-4 overflow-auto`}
      >
        {Array.isArray(data) ? (
          data.map((item) => (
            <div className=" w-[80%]">
              <img src={item} alt="item image" className=" object-cover" />
            </div>
          ))
        ) : (
          <img src={data} alt="item image" className="object-cover" />
        )}
      </div>
    </article>
  );
};
