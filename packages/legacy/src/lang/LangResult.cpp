#include "LangResult.hpp"

LangResult::LangResult(shared_ptr<IGeneratorMeta> meta)
    : _meta(std::move(meta)) {}
shared_ptr<IGeneratorMeta> LangResult::meta() const { return this->_meta; }
shared_ptr<IGeneratorMeta> &LangResult::meta() { return this->_meta; }
LangListPointer LangResult::result() const { return nullptr; }
bool LangResult::empty() const { return true; }