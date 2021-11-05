#include "DictLangResult.hpp"

DictLangResult::DictLangResult(shared_ptr<IGeneratorMeta> meta,
                               LangListPointer dict)
    : LangResult(std::move(meta)), _dict(std::move(dict)) {}
LangListPointer DictLangResult::result() { return this->_dict; }