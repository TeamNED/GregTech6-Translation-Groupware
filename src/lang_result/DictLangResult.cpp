#include "DictLangResult.hpp"

DictLangResult::DictLangResult(shared_ptr<IGeneratorMeta> meta,
                               LangListPointer dict)
    : LangResult(meta), _dict(dict) {}
LangListPointer DictLangResult::result() { return this->_dict; }